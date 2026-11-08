package com.perretwilliam.flashcards.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.Prefs
import com.perretwilliam.flashcards.data.io
import com.perretwilliam.flashcards.lib.CardInput
import com.perretwilliam.flashcards.lib.FOLDER_COLORS
import com.perretwilliam.flashcards.lib.answerSource
import com.perretwilliam.flashcards.lib.isCloze
import com.perretwilliam.flashcards.lib.nextFolderColor
import com.perretwilliam.flashcards.lib.sessionLength
import com.perretwilliam.flashcards.lib.stripCloze
import com.perretwilliam.flashcards.ui.AppButton
import com.perretwilliam.flashcards.ui.ButtonVariant
import com.perretwilliam.flashcards.ui.DetailScreen
import com.perretwilliam.flashcards.ui.Empty
import com.perretwilliam.flashcards.ui.Ic
import com.perretwilliam.flashcards.ui.Input
import com.perretwilliam.flashcards.ui.ListRow
import com.perretwilliam.flashcards.ui.Loading
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.MathMarkdown
import com.perretwilliam.flashcards.ui.Select
import com.perretwilliam.flashcards.ui.Spacing
import com.perretwilliam.flashcards.ui.Surface
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.alert
import com.perretwilliam.flashcards.ui.confirm
import com.perretwilliam.flashcards.ui.deckColor
import com.perretwilliam.flashcards.ui.hex
import com.perretwilliam.flashcards.ui.launchSafe
import com.perretwilliam.flashcards.ui.openCard
import com.perretwilliam.flashcards.ui.rememberQuery
import com.perretwilliam.flashcards.ui.study
import com.perretwilliam.flashcards.ui.studyFolder
import kotlinx.coroutines.delay

/** One-line plain-text preview: list items never render Markdown/KaTeX (no WebView per row). */
private fun preview(s: String) = stripCloze(s).replace(Regex("\\s+"), " ").trim()

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun DeckScreen(nav: NavHostController, id: Long) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val scope = rememberCoroutineScope()
    val data by rememberQuery(id) { Triple(Db.getDeck(id), Db.listCards(id), Db.listFolders()) }
    var query by remember { mutableStateOf("") }
    var name by remember { mutableStateOf<String?>(null) }

    val loaded = data
    if (loaded == null) return DetailScreen("", { nav.popBackStack() }) { Loading() }
    val (deck, cards, folders) = loaded
    if (deck == null) return DetailScreen("", { nav.popBackStack() }) { Empty(tr(R.string.deck_missing)) }

    val q = query.trim().lowercase()
    val shown = if (q.isEmpty()) cards else cards.filter { c -> (listOf(c.front, c.back) + c.tags).any { it.lowercase().contains(q) } }

    val saveName = {
        val n = name
        if (n != null && n.isNotBlank() && n.trim() != deck.name) scope.launchSafe(tr) { io { Db.renameDeck(id, n) } }
        name = null
    }

    DetailScreen(deck.name, { nav.popBackStack() }, tint = theme.deckColor(deck.folderColor)) {
        Input(name ?: deck.name, { name = it }, label = tr(R.string.deck_name), onDone = saveName)
        if (folders.isNotEmpty()) Select(
            deck.folderId ?: -1L,
            listOf(-1L to tr(R.string.deck_noFolder)) + folders.map { it.id to it.name },
            { v -> scope.launchSafe(tr) { io { Db.setDeckFolder(id, v.takeIf { it >= 0 }) } } },
            label = tr(R.string.deck_folder),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            AppButton(
                tr(R.string.deck_study, "count" to sessionLength(cards.size, Prefs.sessionSize)), Ic.study, { nav.study(id) },
                Modifier.weight(1f), enabled = cards.isNotEmpty(),
            )
            AppButton(tr(R.string.deck_addCard), Ic.add, { nav.openCard(-1, id) }, Modifier.weight(1f), ButtonVariant.Secondary)
        }
        if (cards.isNotEmpty()) Input(query, { query = it }, placeholder = tr(R.string.deck_search))
        if (cards.isEmpty()) Empty(tr(R.string.deck_noCards))
        if (cards.isNotEmpty() && shown.isEmpty()) Empty(tr(R.string.deck_noMatch))
        for (c in shown) Box(
            Modifier.combinedClickable(
                onClick = { nav.openCard(c.id, id) },
                onLongClick = {
                    scope.launchSafe(tr) {
                        if (confirm(tr(R.string.card_deleteTitle), tr(R.string.common_cannotUndo), tr(R.string.common_cancel), tr(R.string.common_delete))) io { Db.deleteCard(c.id) }
                    }
                },
            ),
        ) {
            ListRow(preview(c.front), listOf(preview(c.back), c.tags.joinToString(" ") { "#$it" }).filter { it.isNotEmpty() }.joinToString("  ·  "))
        }
        if (cards.isNotEmpty()) T(tr(R.string.deck_hint), variant = TextVariant.Caption)
        AppButton(
            tr(R.string.deck_delete), Ic.delete,
            {
                scope.launchSafe(tr) {
                    if (confirm(tr(R.string.deck_deleteTitle), tr(R.string.deck_deleteMessage, "name" to deck.name), tr(R.string.common_cancel), tr(R.string.common_delete))) {
                        io { Db.deleteDeck(id) }
                        nav.popBackStack()
                    }
                }
            },
            Modifier.fillMaxWidth().padding(top = Spacing.xl), ButtonVariant.Danger,
        )
    }
}

/** Create (`param` = "new") or edit a folder: name and color. Decks are assigned to it from the deck screen. */
@Composable
fun FolderScreen(nav: NavHostController, param: String) {
    val tr = LocalTr.current
    val scope = rememberCoroutineScope()
    val isNew = param == "new"
    val id = param.toLongOrNull() ?: -1L
    // New folders start with the least used palette color.
    val data by rememberQuery(param) { (if (isNew) null else Db.getFolder(id)) to nextFolderColor(Db.listFolders().map { it.color }) }
    var name by remember { mutableStateOf<String?>(null) }
    var color by remember { mutableStateOf<String?>(null) }

    val loaded = data
    if (loaded == null) return DetailScreen("", { nav.popBackStack() }) { Loading() }
    val (folder, suggested) = loaded
    if (!isNew && folder == null) return DetailScreen("", { nav.popBackStack() }) { Empty(tr(R.string.folder_missing)) }

    val shownName = name ?: folder?.name.orEmpty()
    val shownColor = color ?: folder?.color ?: suggested
    val save = {
        if (shownName.isNotBlank()) scope.launchSafe(tr) {
            io { if (folder != null) Db.updateFolder(id, shownName, shownColor) else Db.createFolder(shownName, shownColor) }
            nav.popBackStack()
        }
        Unit
    }

    DetailScreen(folder?.name ?: tr(R.string.folder_newTitle), { nav.popBackStack() }, tint = hex(shownColor)) {
        Input(shownName, { name = it }, label = tr(R.string.folder_name), placeholder = tr(R.string.folder_namePlaceholder), onDone = { save() })
        T(tr(R.string.folder_color), variant = TextVariant.Label)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
            for (c in FOLDER_COLORS) {
                val selected = c.equals(shownColor, ignoreCase = true)
                Box(Modifier.size(44.dp).background(hex(c), CircleShape).combinedClickable(onClick = { color = c }), contentAlignment = Alignment.Center) {
                    if (selected) Icon(Ic.check, null, tint = androidx.compose.ui.graphics.Color.White)
                }
            }
        }
        if (folder != null) {
            T(tr.plural(R.plurals.count_decks, folder.deckCount), variant = TextVariant.Caption)
            AppButton(
                tr(R.string.deck_study, "count" to sessionLength(folder.cardCount, Prefs.sessionSize)), Ic.study,
                { nav.studyFolder(folder.id) }, Modifier.fillMaxWidth(), ButtonVariant.Secondary, enabled = folder.cardCount > 0,
            )
        }
        AppButton(tr(R.string.common_save), Ic.save, { save() }, Modifier.fillMaxWidth(), enabled = shownName.isNotBlank())
        if (folder != null) AppButton(
            tr(R.string.folder_delete), Ic.delete,
            {
                scope.launchSafe(tr) {
                    if (confirm(tr(R.string.folder_deleteTitle), tr(R.string.folder_deleteMessage, "name" to folder.name), tr(R.string.common_cancel), tr(R.string.common_delete))) {
                        io { Db.deleteFolder(id) }
                        nav.popBackStack()
                    }
                }
            },
            Modifier.fillMaxWidth().padding(top = Spacing.xl), ButtonVariant.Danger,
        )
    }
}

/** Editor with live preview; `cardId` -1 creates a card in [deckId]. */
@Composable
fun CardEditorScreen(nav: NavHostController, cardId: Long, deckId: Long) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val scope = rememberCoroutineScope()
    val isNew = cardId < 0
    var loaded by remember { mutableStateOf(isNew) }
    var front by remember { mutableStateOf("") }
    var back by remember { mutableStateOf("") }
    var tags by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf("") }

    LaunchedEffect(cardId) {
        if (!isNew) io { Db.getCard(cardId) }?.let { front = it.front; back = it.back; tags = it.tags.joinToString(", ") }
        loaded = true
    }
    // Debounced so the WebView doesn't reload on every keystroke.
    LaunchedEffect(front, back) {
        delay(400)
        preview = if (front.isNotBlank()) answerSource(front, back) else ""
    }

    val title = tr(if (isNew) R.string.editor_newTitle else R.string.editor_editTitle)
    if (!loaded) return DetailScreen(title, { nav.popBackStack() }) { Loading() }

    val save = { addAnother: Boolean ->
        scope.launchSafe(tr) {
            val ok = tr(R.string.common_ok)
            if (front.isBlank()) return@launchSafe alert(tr(R.string.editor_missingFront), tr(R.string.editor_missingFrontText), ok)
            if (!isCloze(front) && back.isBlank()) return@launchSafe alert(tr(R.string.editor_missingBack), tr(R.string.editor_missingBackText), ok)
            val card = CardInput(front, back, tags.split(",").map { it.trim() }.filter { it.isNotEmpty() })
            io { if (isNew) Db.createCard(deckId, card) else Db.updateCard(cardId, card) }
            if (addAnother) { front = ""; back = "" } else nav.popBackStack()
        }
        Unit
    }

    DetailScreen(title, { nav.popBackStack() }) {
        Input(front, { front = it }, label = tr(R.string.editor_front), placeholder = tr(R.string.editor_frontPlaceholder), multiline = true)
        Input(back, { back = it }, label = tr(R.string.editor_back), placeholder = tr(R.string.editor_backPlaceholder), multiline = true)
        Input(tags, { tags = it }, label = tr(R.string.editor_tags))
        T(tr(R.string.editor_help), variant = TextVariant.Caption)
        if (preview.isNotEmpty()) Surface(tint = theme.primary) {
            T(tr(R.string.editor_preview), variant = TextVariant.Label, color = theme.primary)
            MathMarkdown(preview)
        }
        AppButton(tr(R.string.common_save), Ic.check, { save(false) }, Modifier.fillMaxWidth())
        if (isNew) AppButton(tr(R.string.editor_saveAnother), Ic.add, { save(true) }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
        else AppButton(
            tr(R.string.editor_delete), Ic.delete,
            {
                scope.launchSafe(tr) {
                    if (confirm(tr(R.string.card_deleteTitle), tr(R.string.common_cannotUndo), tr(R.string.common_cancel), tr(R.string.common_delete))) {
                        io { Db.deleteCard(cardId) }
                        nav.popBackStack()
                    }
                }
            },
            Modifier.fillMaxWidth(), ButtonVariant.Danger,
        )
    }
}
