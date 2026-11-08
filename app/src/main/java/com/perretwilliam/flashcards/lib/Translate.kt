package com.perretwilliam.flashcards.lib

private val placeholder = Regex("""\{(\w+)\}""")

/** Replaces `{name}` placeholders. Unknown placeholders are left as-is so they stay visible. */
fun interpolate(template: String, params: Map<String, Any> = emptyMap()): String =
    placeholder.replace(template) { m -> params[m.groupValues[1]]?.toString() ?: m.value }
