package com.perretwilliam.flashcards.lib

// Cloze ("fill in the blank") syntax: `{{c::hidden part}}`.
// The hidden part may contain LaTeX with its own braces, e.g. `{{c::$\frac{1}{x^{2}}$}}`,
// so a regex is not enough: we scan and track brace depth.

private const val OPEN = "{{c::"

data class Segment(val text: String, val cloze: Boolean)

fun splitCloze(input: String): List<Segment> {
    val out = mutableListOf<Segment>()
    var i = 0
    while (i < input.length) {
        val start = input.indexOf(OPEN, i)
        if (start == -1) break
        var depth = 0
        var end = -1
        var j = start + OPEN.length
        while (j < input.length) {
            val ch = input[j]
            if (ch == '{') depth++
            else if (ch == '}') {
                if (depth == 0 && input.getOrNull(j + 1) == '}') {
                    end = j
                    break
                }
                depth--
            }
            j++
        }
        if (end == -1) break // unterminated: keep the rest as plain text
        if (start > i) out += Segment(input.substring(i, start), false)
        out += Segment(input.substring(start + OPEN.length, end), true)
        i = end + 2
    }
    if (i < input.length) out += Segment(input.substring(i), false)
    return out
}

fun isCloze(input: String) = splitCloze(input).any { it.cloze }

/** Markdown with blanks hidden (`reveal = false`) or highlighted (`reveal = true`). */
fun renderCloze(input: String, reveal: Boolean): String =
    splitCloze(input).joinToString("") { s ->
        when {
            !s.cloze -> s.text
            reveal -> "<mark class=\"cloze\">${s.text}</mark>"
            else -> "<span class=\"cloze\">[…]</span>"
        }
    }

/** Markdown for the answer side: question (blanks revealed if cloze), then the back if any. */
fun answerSource(front: String, back: String): String {
    val answer = if (isCloze(front)) renderCloze(front, true) else front
    return if (back.isNotBlank()) "$answer\n\n---\n\n$back" else answer
}

/** Plain text with cloze markers removed, for list previews. */
fun stripCloze(input: String) = splitCloze(input).joinToString("") { it.text }
