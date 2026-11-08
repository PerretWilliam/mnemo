package com.perretwilliam.flashcards.lib

// Deck folders: palette, grouping and color rules. Pure, so it is unit-tested.

/** Folder colors (readable on light and dark backgrounds). */
val FOLDER_COLORS = listOf("#6366F1", "#EC4899", "#F59E0B", "#10B981", "#06B6D4", "#8B5CF6", "#EF4444", "#84CC16")

private val hexColor = Regex("^#[0-9a-fA-F]{6}$")

/** Only `#RRGGBB` is accepted. */
fun isHexColor(v: Any?) = v is String && hexColor.matches(v)

/** Palette color used the fewest times (first one on ties), so new folders get distinct colors. */
fun nextFolderColor(used: List<String>): String {
    fun count(c: String) = used.count { it.equals(c, ignoreCase = true) }
    return FOLDER_COLORS.reduce { best, c -> if (count(c) < count(best)) c else best }
}

class Section<F, D>(val folder: F?, val decks: List<D>)

/**
 * One section per folder (empty ones included, so they stay reachable), in the given order,
 * then the unfiled decks as a `folder = null` section when there are any.
 */
fun <F, D> groupByFolder(
    folders: List<F>,
    decks: List<D>,
    folderId: (F) -> Long,
    deckFolderId: (D) -> Long?,
): List<Section<F, D>> {
    val sections = folders.map { f -> Section(f, decks.filter { deckFolderId(it) == folderId(f) }) }.toMutableList()
    val ids = folders.map(folderId).toSet()
    val unfiled = decks.filter { deckFolderId(it).let { id -> id == null || id !in ids } }
    if (unfiled.isNotEmpty()) sections += Section(null, unfiled)
    return sections
}
