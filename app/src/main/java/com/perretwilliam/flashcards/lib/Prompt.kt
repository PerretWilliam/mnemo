package com.perretwilliam.flashcards.lib

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class CardTypes(val label: String) {
    QA("question/answer only"),
    CLOZE("cloze (fill in the blank) only"),
    BOTH("a mix of question/answer and cloze"),
}

data class PromptOptions(
    val topic: String,
    val deckName: String,
    /** Optional folder the deck is filed in on import. */
    val folder: String = "",
    val count: Int,
    val types: CardTypes,
    val language: String,
    val notes: String = "",
)

/** Builds the prompt the user pastes into ChatGPT / Claude. The answer is imported via the clipboard. */
fun buildPrompt(o: PromptOptions): String {
    val example = buildJsonObject {
        put("version", 1)
        put("decks", buildJsonArray {
            add(buildJsonObject {
                put("name", o.deckName)
                if (o.folder.isNotBlank()) put("folder", o.folder.trim())
                put("cards", buildJsonArray {
                    add(buildJsonObject {
                        put("front", "...")
                        put("back", "...")
                        put("tags", JsonArray(listOf(JsonPrimitive("..."))))
                    })
                })
            })
        })
    }
    val lines = mutableListOf(
        "You generate flashcards for an app. Reply ONLY with one valid ```json block, with no text before or after.",
        "",
        "Exact format:",
        example.toString(),
        "",
        "Rules:",
        "- ${o.count} cards about: ${o.topic}. Language of the cards: ${o.language}.",
        "- Allowed card types: ${o.types.label}.",
    )
    if (o.types != CardTypes.CLOZE) lines += "  - Question/answer: \"front\" = question, \"back\" = answer."
    if (o.types != CardTypes.QA) {
        lines += "  - Cloze: in \"front\", wrap every part to hide with {{c::...}}; \"back\" may be empty or hold a short explanation."
    }
    lines += "- \"front\" and \"back\" are Markdown. Math uses KaTeX LaTeX: \$...\$ inline, \$\$...\$\$ for blocks."
    lines += "- This is JSON: every LaTeX backslash must be doubled (\\\\frac, \\\\int, \\\\alpha)."
    lines += "- One idea per card, short answers, no invented information."
    val notes = o.notes.trim()
    if (notes.isNotEmpty()) lines += listOf("- Use only these notes as your source:", "\"\"\"", notes, "\"\"\"")
    return lines.joinToString("\n")
}
