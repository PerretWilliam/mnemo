package com.perretwilliam.flashcards.lib

// JSON exchange format shared by import, export and AI generation. See docs/FORMAT.md for the spec.

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

data class CardInput(val front: String, val back: String, val tags: List<String>)
data class DeckInput(val name: String, val folder: String? = null, val cards: List<CardInput>)
data class FolderInput(val name: String, val color: String)
data class HistoryInput(val deck: String, val startedAt: String, val endedAt: String, val correct: Int, val wrong: Int)
data class ExchangeFile(
    val decks: List<DeckInput>,
    val folders: List<FolderInput>? = null,
    val history: List<HistoryInput>? = null,
)

/** Problems are codes + params so the UI can translate them (`issue_<code>` strings). */
enum class IssueCode {
    INVALID_JSON, ROOT_OBJECT, VERSION, DECKS_ARRAY, DECK_NAME, CARDS_ARRAY, DECK_FOLDER, FOLDERS_ARRAY,
    FOLDER_ENTRY, FRONT, BACK_TYPE, TAGS, BACK_REQUIRED, HISTORY_ARRAY, HISTORY_ENTRY, REPAIRED_BACKSLASHES,
    RESTORED_LATEX,
}

data class Issue(val code: IssueCode, val params: Map<String, Any> = emptyMap())

class ParseResult(
    /** Valid content only; `null` when the file is unusable. */
    val data: ExchangeFile?,
    /** Problems that made something get skipped. */
    val errors: List<Issue>,
    /** Things that were fixed automatically. */
    val warnings: List<Issue>,
)

private val fence = Regex("```(?:json)?\\s*([\\s\\S]*?)```")

/** Takes raw text (a file, or an AI answer with prose and ``` fences) and extracts the JSON. */
private fun extractJson(raw: String): String {
    fence.find(raw)?.let { return it.groupValues[1] }
    val first = raw.indexOf('{')
    val last = raw.lastIndexOf('}')
    return if (first != -1 && last > first) raw.substring(first, last + 1) else raw
}

private val backslash = Regex("\\\\(\\\\|u[0-9a-fA-F]{4}|[\\s\\S])")

/**
 * AIs often write LaTeX with single backslashes inside JSON strings.
 * `\int`, `\alpha`... are invalid JSON escapes: we double them so parsing succeeds.
 */
private fun escapeInvalidBackslashes(json: String): Pair<String, Int> {
    var count = 0
    val text = backslash.replace(json) { m ->
        val c = m.groupValues[1]
        if (c == "\\" || c.length == 5 || "\"/bfnrt".contains(c)) m.value
        else {
            count++
            "\\\\$c"
        }
    }
    return text to count
}

private val tabBeforeLetter = Regex("\t(?=[a-zA-Z])")
private val crBeforeLetter = Regex("\r(?=[a-zA-Z])")
private val math = Regex("\\$\\$[\\s\\S]*?\\$\\$|\\$[^$]*\\$")
private val newlineBeforeLetter = Regex("\n(?=[a-zA-Z])")

/**
 * The sneaky half of the backslash trap: `\frac`, `\theta`, `\right`, `\neq` are *valid*
 * JSON escapes and silently become control characters. We turn them back into LaTeX.
 * `\n` is only restored inside inline `$...$` math, where a real newline never belongs.
 */
fun restoreLatex(s: String): String {
    val fixed = s
        .replace("\u000c", "\\f")
        .replace("\u0008", "\\b")
        .let { tabBeforeLetter.replace(it) { "\\t" } }
        .let { crBeforeLetter.replace(it) { "\\r" } }
    return math.replace(fixed) { m ->
        if (m.value.startsWith("$$")) m.value else newlineBeforeLetter.replace(m.value) { "\\n" }
    }
}

/** Parses an ISO 8601 date(-time); like JavaScript's Date.parse, a bare date means UTC. Null if invalid. */
fun parseIsoMillis(s: String): Long? =
    runCatching { Instant.parse(s).toEpochMilli() }.getOrNull()
        ?: runCatching { OffsetDateTime.parse(s).toInstant().toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDateTime.parse(s).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrNull()
        ?: runCatching { LocalDate.parse(s).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()

private val isoMillis = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
fun formatIsoMillis(ms: Long): String = isoMillis.format(Instant.ofEpochMilli(ms))

private fun JsonElement?.str(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
private fun JsonElement?.nonEmpty(): String? = str()?.takeIf { it.isNotBlank() }
private fun JsonElement?.count(): Int? {
    val p = this as? JsonPrimitive ?: return null
    if (p.isString) return null
    val d = p.content.toDoubleOrNull() ?: return null
    return if (d >= 0 && d % 1.0 == 0.0) d.toInt() else null
}

fun parseExchange(raw: String): ParseResult {
    val errors = mutableListOf<Issue>()
    val warnings = mutableListOf<Issue>()

    val text = extractJson(raw.trim())
    val json: JsonElement = try {
        Json.parseToJsonElement(text)
    } catch (_: Exception) {
        val (fixed, count) = escapeInvalidBackslashes(text)
        try {
            Json.parseToJsonElement(fixed).also { warnings += Issue(IssueCode.REPAIRED_BACKSLASHES, mapOf("count" to count)) }
        } catch (e: Exception) {
            return ParseResult(null, listOf(Issue(IssueCode.INVALID_JSON, mapOf("detail" to (e.message ?: "")))), warnings)
        }
    }

    // Like JavaScript, an array is an object here; it just has no "version".
    if (json !is JsonObject && json !is JsonArray) return ParseResult(null, listOf(Issue(IssueCode.ROOT_OBJECT)), warnings)
    val root = json as? JsonObject ?: JsonObject(emptyMap())
    val version = (root["version"] as? JsonPrimitive)?.takeIf { !it.isString }?.content?.toDoubleOrNull()
    if (version != 1.0) return ParseResult(null, listOf(Issue(IssueCode.VERSION)), warnings)
    val rawDecks = root["decks"] as? JsonArray
    if (rawDecks == null || rawDecks.isEmpty()) return ParseResult(null, listOf(Issue(IssueCode.DECKS_ARRAY)), warnings)

    var latexFixes = 0
    fun fix(s: String) = restoreLatex(s).also { if (it != s) latexFixes++ }

    val decks = mutableListOf<DeckInput>()
    rawDecks.forEachIndexed deck@{ di, d ->
        val deck = d as? JsonObject ?: JsonObject(emptyMap())
        val name = deck["name"].nonEmpty()?.trim()
        if (name == null) {
            errors += Issue(IssueCode.DECK_NAME, mapOf("deck" to di + 1))
            return@deck
        }
        val rawCards = deck["cards"] as? JsonArray
        if (rawCards == null) {
            errors += Issue(IssueCode.CARDS_ARRAY, mapOf("deck" to name))
            return@deck
        }
        val cards = mutableListOf<CardInput>()
        rawCards.forEachIndexed card@{ ci, c ->
            val card = c as? JsonObject ?: JsonObject(emptyMap())
            val where = mapOf("deck" to name, "card" to ci + 1)
            val front = card["front"].nonEmpty()
            if (front == null) {
                errors += Issue(IssueCode.FRONT, where)
                return@card
            }
            if (card.containsKey("back") && card["back"].str() == null) {
                errors += Issue(IssueCode.BACK_TYPE, where)
                return@card
            }
            val rawTags = card["tags"]
            val tags = (rawTags as? JsonArray)?.map { it.str() }
            if (card.containsKey("tags") && (tags == null || tags.any { it == null })) {
                errors += Issue(IssueCode.TAGS, where)
                return@card
            }
            val fixedFront = fix(front)
            val fixedBack = fix(card["back"].str() ?: "")
            if (!fixedFront.contains("{{c::") && fixedBack.isBlank()) {
                errors += Issue(IssueCode.BACK_REQUIRED, where)
                return@card
            }
            cards += CardInput(fixedFront, fixedBack, tags.orEmpty().map { it!!.trim() }.filter { it.isNotEmpty() })
        }
        var folder: String? = null
        if (deck.containsKey("folder")) {
            val f = deck["folder"].str()
            if (f != null) folder = f.trim().ifEmpty { null } else errors += Issue(IssueCode.DECK_FOLDER, mapOf("deck" to name))
        }
        decks += DeckInput(name, folder, cards)
    }

    if (latexFixes > 0) warnings += Issue(IssueCode.RESTORED_LATEX, mapOf("count" to latexFixes))

    var folders: List<FolderInput>? = null
    if (root.containsKey("folders")) {
        val arr = root["folders"] as? JsonArray
        if (arr == null) errors += Issue(IssueCode.FOLDERS_ARRAY)
        else {
            val list = mutableListOf<FolderInput>()
            arr.forEachIndexed { fi, f ->
                val e = f as? JsonObject ?: JsonObject(emptyMap())
                val name = e["name"].nonEmpty()
                val color = e["color"].str()
                if (name != null && isHexColor(color)) list += FolderInput(name.trim(), color!!)
                else errors += Issue(IssueCode.FOLDER_ENTRY, mapOf("entry" to fi + 1))
            }
            folders = list
        }
    }

    var history: List<HistoryInput>? = null
    if (root.containsKey("history")) {
        val arr = root["history"] as? JsonArray
        if (arr == null) errors += Issue(IssueCode.HISTORY_ARRAY)
        else {
            val list = mutableListOf<HistoryInput>()
            arr.forEachIndexed { hi, h ->
                val e = h as? JsonObject ?: JsonObject(emptyMap())
                val deck = e["deck"].nonEmpty()
                val started = e["startedAt"].str()
                val ended = e["endedAt"].str()
                val correct = e["correct"].count()
                val wrong = e["wrong"].count()
                if (deck != null && started != null && parseIsoMillis(started) != null &&
                    ended != null && parseIsoMillis(ended) != null && correct != null && wrong != null
                ) {
                    list += HistoryInput(deck, started, ended, correct, wrong)
                } else errors += Issue(IssueCode.HISTORY_ENTRY, mapOf("entry" to hi + 1))
            }
            history = list
        }
    }

    if (decks.isEmpty()) return ParseResult(null, errors, warnings)
    return ParseResult(ExchangeFile(decks, folders?.takeIf { it.isNotEmpty() }, history), errors, warnings)
}
