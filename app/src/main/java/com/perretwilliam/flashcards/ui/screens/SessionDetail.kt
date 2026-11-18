package com.perretwilliam.flashcards.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.lib.stripCloze
import com.perretwilliam.flashcards.ui.DetailScreen
import com.perretwilliam.flashcards.ui.Empty
import com.perretwilliam.flashcards.ui.ListRow
import com.perretwilliam.flashcards.ui.Loading
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.deckColor
import com.perretwilliam.flashcards.ui.rememberQuery

/** Read-only view of one past session: what was missed, then what was got right. */
@Composable
fun SessionDetailScreen(nav: NavHostController, id: Long) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val data by rememberQuery(id) { Db.getSession(id) to Db.listSessionCards(id) }
    val back = { nav.popBackStack(); Unit }
    val (session, cards) = data ?: return DetailScreen("", back) { Loading() }
    if (session == null) return DetailScreen("", back) { Empty(tr(R.string.deck_missing)) }
    DetailScreen(session.deckName, back, tint = theme.deckColor(session.folderColor)) {
        if (cards.isEmpty()) Empty(tr(R.string.history_noDetails))
        val (correct, missed) = cards.partition { it.correct }
        if (missed.isNotEmpty()) T(tr(R.string.history_missedCards, "count" to missed.size), variant = TextVariant.Heading, color = theme.danger)
        for (c in missed) ListRow(stripCloze(c.front), stripCloze(c.back))
        if (correct.isNotEmpty()) T(tr(R.string.history_correctCards, "count" to correct.size), variant = TextVariant.Heading, color = theme.success)
        for (c in correct) ListRow(stripCloze(c.front), stripCloze(c.back))
    }
}
