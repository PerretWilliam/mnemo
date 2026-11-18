package com.perretwilliam.flashcards.lib

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Multiple-choice (MCQ) mode. A question comes from either a card written as multiple choice (`Card.choices`)
// or any regular card: its answer is the right choice and the wrong ones are answers of other cards.

const val MIN_CHOICES = 2
const val MAX_CHOICES = 8

/** One option of an authored multiple-choice card. Several correct options make a "select all that apply" question. */
data class Choice(val text: String, val correct: Boolean)

/** Study modes: self-graded flashcards, or multiple choice. */
enum class StudyMode { CARDS, MCQ }

data class McqConfig(
    /** Options per generated question (the right answer included). Authored cards keep all their own options. */
    val choices: Int = 4,
    /** Ask regular cards too, with wrong answers borrowed from the deck or folder. Off: only authored MCQ cards. */
    val generate: Boolean = true,
    /** Shuffle the options of authored cards (generated questions are always shuffled). */
    val shuffle: Boolean = true,
    /** Reveal right and wrong after each answer. Off: no feedback until the recap, like an exam. */
    val instant: Boolean = true,
    /** Show the card's back as an explanation once answered (instant feedback only). */
    val explain: Boolean = true,
    /** Move on by itself shortly after a correct answer (instant feedback only). */
    val autoNext: Boolean = false,
    /** Seconds allowed per question; 0 = no limit. Running out counts as missed. */
    val timerSec: Int = 0,
)

val MCQ_CHOICE_COUNTS = listOf(3, 4, 5, 6)
val MCQ_TIMERS = listOf(0, 10, 20, 30, 60, 120)

/** The card fields a question is built from, so this file doesn't depend on the data layer. */
data class McqSource(val id: Long, val front: String, val back: String, val tags: List<String>, val choices: List<Choice>?)

data class McqQuestion(val cardId: Long, val prompt: String, val options: List<Choice>, val explanation: String) {
    val correctIndices: Set<Int> get() = options.indices.filter { options[it].correct }.toSet()
    val multi: Boolean get() = correctIndices.size > 1
    val answer: String get() = options.filter { it.correct }.joinToString(" · ") { it.text }
}

/** All-or-nothing: exactly the right options must be picked. */
fun gradeMcq(q: McqQuestion, picked: Set<Int>) = picked == q.correctIndices

/** The options picked, as text for the history. Null when nothing was picked. */
fun pickedText(q: McqQuestion, picked: Set<Int>): String? =
    picked.sorted().takeIf { it.isNotEmpty() }?.joinToString(" · ") { q.options[it].text }

fun List<Choice>.isValidMcq() = size in MIN_CHOICES..MAX_CHOICES && any { it.correct } && all { it.text.isNotBlank() }

/** Short options render as plain text; anything with Markdown or math needs the (heavier) renderer. */
fun isPlainText(s: String) = s.none { it in "$`*_\\<>\n" }

/** What the card's answer is when asked as a generated question: the hidden parts of a cloze, else the back. */
private fun answerOf(c: McqSource) = if (isCloze(c.front)) splitCloze(c.front).filter { it.cloze }.joinToString(" · ") { it.text.trim() } else c.back.trim()

/**
 * Builds the question for [card], or null when it can't be asked (a regular card with generation off, or no
 * other answer to use as a wrong option). [pool] is every card that can lend a wrong answer.
 */
fun buildQuestion(card: McqSource, pool: List<McqSource>, cfg: McqConfig, rng: () -> Double): McqQuestion? {
    card.choices?.takeIf { it.isValidMcq() }?.let { options ->
        return McqQuestion(card.id, card.front, if (cfg.shuffle) shuffled(options, rng) else options, card.back)
    }
    if (!cfg.generate) return null
    val answer = answerOf(card)
    if (answer.isBlank()) return null

    // Wrong options: distinct answers of other regular cards, favoring same tags and a similar length so they look plausible.
    val candidates = pool.filter { it.id != card.id && it.choices == null }
        .map { it to answerOf(it) }
        .filter { (_, a) -> a.isNotBlank() && !a.equals(answer, ignoreCase = true) }
        .distinctBy { it.second.lowercase() }
    val weight = { c: Pair<McqSource, String> ->
        val shared = c.first.tags.count { it in card.tags }
        val similarity = minOf(c.second.length, answer.length).coerceAtLeast(1).toDouble() / maxOf(c.second.length, answer.length).coerceAtLeast(1)
        1.0 + 2 * shared + 2 * similarity
    }
    val wrong = weightedSample(candidates, weight, cfg.choices - 1, rng)
    if (wrong.isEmpty()) return null
    val options = shuffled(listOf(Choice(answer, true)) + wrong.map { Choice(it.second, false) }, rng)
    val prompt = if (isCloze(card.front)) renderCloze(card.front, false) else card.front
    return McqQuestion(card.id, prompt, options, if (isCloze(card.front)) card.back else "")
}

private fun <T> shuffled(items: List<T>, rng: () -> Double) = weightedSample(items, { 1.0 }, items.size, rng)

// --- JSON (database column and exchange format share the same shape) ---

fun choicesToJson(choices: List<Choice>): JsonArray =
    JsonArray(choices.map { c -> buildJsonObject { put("text", c.text); put("correct", c.correct) } })

fun choicesFromJson(json: String?): List<Choice>? =
    json?.let { s ->
        runCatching { Json.parseToJsonElement(s).jsonArray.map { Choice(it.jsonObject["text"]!!.jsonPrimitive.content, it.jsonObject["correct"]!!.jsonPrimitive.boolean) } }.getOrNull()
    }

/** One choice entry of an import file; null when malformed (`correct` may be left out: false). */
internal fun parseChoice(e: JsonElement): Choice? {
    val o = e as? JsonObject ?: return null
    val text = (o["text"] as? JsonPrimitive)?.takeIf { it.isString }?.content?.takeIf { it.isNotBlank() } ?: return null
    val correct = when (val c = o["correct"]) {
        null -> false
        is JsonPrimitive -> c.takeIf { !it.isString }?.content?.toBooleanStrictOrNull() ?: return null
        else -> return null
    }
    return Choice(text, correct)
}
