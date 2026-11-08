package com.perretwilliam.flashcards

import com.perretwilliam.flashcards.lib.*
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.Assert.*
import org.junit.Test

class LibTest {
    private val raw = { s: String -> s } // keeps the LaTeX strings below readable

    @Test fun `translate - interpolation`() {
        assertEquals("3 cards in D", interpolate("{count} cards in {deck}", mapOf("count" to 3, "deck" to "D")))
        assertEquals("keep {unknown}", interpolate("keep {unknown}"))
        assertEquals("{{c::x}}", interpolate("{{c::x}}"))
    }

    private val paris = ZoneId.of("Europe/Paris")
    private fun at(daysAgo: Int) = LocalDateTime.of(2026, 5, 10 - daysAgo, 9, 0).atZone(paris).toInstant().toEpochMilli()
    private class S(override val endedAt: Long, override val correct: Int, override val wrong: Int) : SessionLike

    @Test fun `stats - daily buckets, streak and success rate`() {
        val now = LocalDateTime.of(2026, 5, 10, 15, 0).atZone(paris).toInstant().toEpochMilli()
        val sessions = listOf(S(at(0), 3, 1), S(at(0), 1, 0), S(at(1), 2, 2), S(at(3), 1, 1))
        assertEquals(listOf(2, 0, 4, 5), dailyReviews(sessions, 4, now, paris).map { it.count })
        val today = dailyReviews(sessions, 1, now, paris).single()
        assertEquals(4 to 1, today.correct to today.wrong)
        assertEquals(2, streak(sessions, now, paris))
        assertEquals(1, streak(sessions.drop(2), now, paris)) // nothing today: counts from yesterday
        assertEquals(64, successRate(sessions))
        assertNull(successRate(emptyList()))
    }

    @Test fun `cloze - splits plain text and blanks`() {
        assertEquals(
            listOf(Segment("A primitive of cos is ", false), Segment("sin", true), Segment(".", false)),
            splitCloze("A primitive of cos is {{c::sin}}."),
        )
    }

    @Test fun `cloze - keeps nested LaTeX braces inside the blank`() {
        val s = "Derivative: {{c::\$\\frac{1}{x^{2}}\$}} here"
        assertEquals("\$\\frac{1}{x^{2}}\$", splitCloze(s)[1].text)
        assertEquals("Derivative: \$\\frac{1}{x^{2}}\$ here", stripCloze(s))
    }

    @Test fun `cloze - hides and reveals`() {
        val s = "{{c::a}} and {{c::b}}"
        assertEquals("<span class=\"cloze\">[…]</span> and <span class=\"cloze\">[…]</span>", renderCloze(s, false))
        assertEquals("<mark class=\"cloze\">a</mark> and <mark class=\"cloze\">b</mark>", renderCloze(s, true))
    }

    @Test fun `cloze - plain and unterminated text is not a cloze`() {
        assertFalse(isCloze("no blanks"))
        assertFalse(isCloze("broken {{c::oops"))
        assertEquals("broken {{c::oops", stripCloze("broken {{c::oops"))
        assertEquals("Q\n\n---\n\nA", answerSource("Q", "A"))
        assertEquals("Q", answerSource("Q", "  "))
    }

    @Test fun `format - accepts a valid file wrapped in an AI answer`() {
        val r = parseExchange("Sure!\n```json\n{\"version\":1,\"decks\":[{\"name\":\"D\",\"cards\":[{\"front\":\"Q\",\"back\":\"A\"}]}]}\n```")
        assertEquals(emptyList<Issue>(), r.errors)
        assertEquals(CardInput("Q", "A", emptyList()), r.data!!.decks[0].cards[0])
    }

    @Test fun `format - repairs single LaTeX backslashes (invalid and silently valid escapes)`() {
        // Written as an AI would: \int is an invalid escape, \frac and \theta are valid ones (\f, \t).
        val latex = """${'$'}\int x${'$'} and ${'$'}\frac{1}{2}${'$'}, ${'$'}\theta${'$'}, ${'$'}\neq${'$'}"""
        val r = parseExchange("""{"version":1,"decks":[{"name":"D","cards":[{"front":"$latex","back":"ok"}]}]}""")
        assertEquals(latex, r.data!!.decks[0].cards[0].front)
        assertTrue(r.warnings.isNotEmpty())
    }

    @Test fun `format - keeps real newlines outside inline math`() {
        assertEquals("line\nNext \$a\\nb\$", restoreLatex("line\nNext \$a\nb\$"))
    }

    @Test fun `format - reports invalid cards with their number and keeps the valid ones`() {
        val r = parseExchange(
            """{"version":1,"decks":[{"name":"D","cards":[{"front":"ok","back":"ok"},{"front":""},{"front":"q","back":""},{"front":"{{c::x}}"}]}]}""",
        )
        assertEquals(2, r.data!!.decks[0].cards.size)
        assertEquals(Issue(IssueCode.FRONT, mapOf("deck" to "D", "card" to 2)), r.errors[0])
        assertEquals(Issue(IssueCode.BACK_REQUIRED, mapOf("deck" to "D", "card" to 3)), r.errors[1])
    }

    @Test fun `format - rejects wrong version and garbage`() {
        assertNull(parseExchange("{\"version\":2,\"decks\":[]}").data)
        assertNull(parseExchange("not json").data)
        assertEquals(IssueCode.INVALID_JSON, parseExchange("not json").errors[0].code)
        assertEquals(IssueCode.ROOT_OBJECT, parseExchange("42").errors[0].code)
    }

    @Test fun `format - reads deck folders and the folders list, old files stay unfiled`() {
        val r = parseExchange(
            """{"version":1,"folders":[{"name":" AC03 ","color":"#10B981"}],"decks":[
                {"name":"A","folder":" AC03 ","cards":[{"front":"q","back":"a"}]},
                {"name":"B","cards":[{"front":"q","back":"a"}]}]}""",
        )
        assertEquals(emptyList<Issue>(), r.errors)
        assertEquals(listOf(FolderInput("AC03", "#10B981")), r.data!!.folders)
        assertEquals("AC03", r.data!!.decks[0].folder)
        assertNull(r.data!!.decks[1].folder)
        assertNull(parseExchange("""{"version":1,"decks":[{"name":"D","cards":[{"front":"Q","back":"A"}]}]}""").data!!.folders)
    }

    @Test fun `format - reports bad folder fields without dropping the deck`() {
        val r = parseExchange(
            """{"version":1,"folders":[{"name":"ok","color":"#123456"},{"name":"bad","color":"red"},{"color":"#123456"}],
                "decks":[{"name":"D","folder":3,"cards":[{"front":"q","back":"a"}]}]}""",
        )
        assertEquals(1, r.data!!.decks.size)
        assertEquals(listOf(FolderInput("ok", "#123456")), r.data!!.folders)
        assertEquals(
            listOf(
                Issue(IssueCode.DECK_FOLDER, mapOf("deck" to "D")),
                Issue(IssueCode.FOLDER_ENTRY, mapOf("entry" to 2)),
                Issue(IssueCode.FOLDER_ENTRY, mapOf("entry" to 3)),
            ),
            r.errors,
        )
        assertEquals(IssueCode.FOLDERS_ARRAY, parseExchange("""{"version":1,"folders":{},"decks":[{"name":"D","cards":[]}]}""").errors[0].code)
    }

    @Test fun `format - history entries and ISO dates`() {
        val r = parseExchange(
            """{"version":1,"decks":[{"name":"D","cards":[]}],"history":[
                {"deck":"D","startedAt":"2026-05-10T08:00:00.000Z","endedAt":"2026-05-10T08:05:00.000Z","correct":3,"wrong":1},
                {"deck":"D","startedAt":"nope","endedAt":"2026-05-10T08:05:00.000Z","correct":3,"wrong":1}]}""",
        )
        assertEquals(1, r.data!!.history!!.size)
        assertEquals(IssueCode.HISTORY_ENTRY, r.errors.single().code)
        val ms = parseIsoMillis("2026-05-10T08:00:00.000Z")!!
        assertEquals("2026-05-10T08:00:00.000Z", formatIsoMillis(ms))
        assertNull(parseIsoMillis("nope"))
    }

    @Test fun `folders - palette color is the least used, hex validation`() {
        assertEquals(FOLDER_COLORS[0], nextFolderColor(emptyList()))
        assertEquals(FOLDER_COLORS[2], nextFolderColor(listOf(FOLDER_COLORS[0].lowercase(), FOLDER_COLORS[1])))
        assertEquals(FOLDER_COLORS[0], nextFolderColor(FOLDER_COLORS))
        assertEquals(FOLDER_COLORS[1], nextFolderColor(FOLDER_COLORS + FOLDER_COLORS[0]))
        assertTrue(isHexColor("#aBc123"))
        assertTrue(!isHexColor("#abc") && !isHexColor("abc123") && !isHexColor(42))
    }

    private data class F(val id: Long)
    private data class D(val name: String, val folderId: Long?)

    @Test fun `folders - groups decks by folder, keeps empty folders, unfiled last`() {
        val decks = listOf(D("a", 2), D("b", null), D("c", 2), D("d", 99)) // 99: dangling reference, treated as unfiled
        val s = groupByFolder(listOf(F(1), F(2)), decks, { it.id }, { it.folderId })
        assertEquals(
            listOf(1L to emptyList<String>(), 2L to listOf("a", "c"), null to listOf("b", "d")),
            s.map { it.folder?.id to it.decks.map(D::name) },
        )
        assertEquals(0, groupByFolder(emptyList<F>(), emptyList<D>(), { it.id }, { it.folderId }).size)
    }

    /** Small deterministic PRNG (mulberry32) so the statistical tests never flake. */
    private fun seeded(start: Int): () -> Double {
        var seed = start
        return {
            seed += 0x6d2b79f5
            var t = (seed xor (seed ushr 15)) * (1 or seed)
            t = (t + (t xor (t ushr 7)) * (61 or t)) xor t
            ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).plus(1) / 4294967297.0
        }
    }

    private data class C(val id: Long)

    @Test fun `sampling - never-seen and missed cards weigh more than mastered ones`() {
        assertTrue(cardWeight() > cardWeight(CardStat(3, 1)))
        assertTrue(cardWeight(CardStat(3, 0)) > cardWeight(CardStat(3, 1)))
        assertTrue(cardWeight(CardStat(3, 1)) > cardWeight(CardStat(3, 4)))
        assertTrue(cardWeight(CardStat(9, 50)) > 0) // mastered cards still come back
        assertEquals(10, sessionLength(30, 10))
        assertEquals(3, sessionLength(3, 10))
        assertEquals(30, sessionLength(30, 0))
    }

    @Test fun `sampling - draws the requested number of distinct cards, 0 means all`() {
        val cards = List(30) { C(it.toLong()) }
        val rng = seeded(1)
        val picked = drawCards(cards, { it.id }, emptyMap(), 10, rng)
        assertEquals(10, picked.size)
        assertEquals(10, picked.map { it.id }.toSet().size)
        assertEquals(30, drawCards(cards, { it.id }, emptyMap(), 0, rng).size)
        assertEquals(30, drawCards(cards, { it.id }, emptyMap(), 100, rng).size)
        assertEquals(emptyList<C>(), drawCards(emptyList<C>(), { it.id }, emptyMap(), 5))
    }

    @Test fun `sampling - missed and unseen cards are drawn more often than mastered ones`() {
        // 10 mastered cards, 5 missed, 5 never seen; sessions of 5.
        val cards = List(20) { C(it.toLong()) }
        val stats = buildMap {
            for (id in 0L until 10) put(id, CardStat(6, 5))
            for (id in 10L until 15) put(id, CardStat(2, 0))
        }
        val rng = seeded(42)
        val hits = intArrayOf(0, 0, 0) // mastered, missed, unseen
        repeat(2000) {
            for (c in drawCards(cards, { it.id }, stats, 5, rng)) hits[if (c.id < 10) 0 else if (c.id < 15) 1 else 2]++
        }
        // Per card: mastered weight 0.2, unseen 3, missed 4.
        assertTrue(hits.toList().toString(), hits[1] / 5.0 > 4 * (hits[0] / 10.0))
        assertTrue(hits.toList().toString(), hits[2] / 5.0 > 4 * (hits[0] / 10.0))
        assertTrue(hits[0] > 0)
    }

    @Test fun `prompt - includes options and optional notes`() {
        val p = buildPrompt(PromptOptions("Derivatives", "Calc", count = 10, types = CardTypes.QA, language = "French", notes = "my notes"))
        assertTrue(p.contains("10 cards about: Derivatives"))
        assertTrue(p.contains("\"name\":\"Calc\""))
        assertTrue(p.contains("my notes"))
        assertFalse(p.contains("{{c::"))
        assertFalse(p.contains("\"folder\""))
        assertTrue(p.contains("(\\\\frac, \\\\int, \\\\alpha)"))
        val f = buildPrompt(PromptOptions("t", "Calc", folder = " MA101 ", count = 5, types = CardTypes.QA, language = "French"))
        assertTrue(f.contains("\"name\":\"Calc\",\"folder\":\"MA101\",\"cards\""))
    }

    @Test
    fun exportRoundTrips() {
        val file = ExchangeFile(
            listOf(DeckInput("D", "F", listOf(CardInput("a \\frac{1}{2}", "b", listOf("t"))))),
            listOf(FolderInput("F", "#4F46E5")),
        )
        val back = parseExchange(file.toJson())
        assertEquals(file, back.data)
        assertTrue(back.errors.isEmpty())
    }
}
