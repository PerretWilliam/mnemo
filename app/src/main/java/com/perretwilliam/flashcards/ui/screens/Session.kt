package com.perretwilliam.flashcards.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.data.Card
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.Prefs
import com.perretwilliam.flashcards.data.io
import com.perretwilliam.flashcards.lib.answerSource
import com.perretwilliam.flashcards.lib.drawCards
import com.perretwilliam.flashcards.lib.isCloze
import com.perretwilliam.flashcards.lib.renderCloze
import com.perretwilliam.flashcards.lib.stripCloze
import com.perretwilliam.flashcards.ui.AppButton
import com.perretwilliam.flashcards.ui.ButtonVariant
import com.perretwilliam.flashcards.ui.DetailScreen
import com.perretwilliam.flashcards.ui.Empty
import com.perretwilliam.flashcards.ui.Ic
import com.perretwilliam.flashcards.ui.ListRow
import com.perretwilliam.flashcards.ui.Loading
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.MathMarkdown
import com.perretwilliam.flashcards.ui.Radius
import com.perretwilliam.flashcards.ui.Spacing
import com.perretwilliam.flashcards.ui.Surface
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.alpha
import com.perretwilliam.flashcards.ui.deckColor
import kotlin.math.abs
import kotlin.math.sign
import kotlinx.coroutines.launch

private val SWIPE_THRESHOLD = 110.dp

private class Result(val card: Card, val correct: Boolean)

/** Studies one deck, or a whole folder when [isFolder]. Swipe left = correct, swipe right = missed. */
@Composable
fun SessionScreen(nav: NavHostController, isFolder: Boolean, id: Long) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    var title by remember { mutableStateOf("") }
    var folderColor by remember { mutableStateOf<String?>(null) }
    var round by remember { mutableStateOf<List<Card>?>(null) }
    val results = remember { mutableStateListOf<Result>() }
    var flipped by remember { mutableStateOf(false) }
    var startedAt by remember { mutableLongStateOf(0L) }

    // A fresh random sample (size from Settings); missed and never-seen cards are favored.
    suspend fun draw(): List<Card> = io {
        val cards = if (isFolder) Db.listFolderCards(id) else Db.listCards(id)
        drawCards(cards, { it.id }, Db.getCardStats(), Prefs.sessionSize)
    }
    fun start(cards: List<Card>) {
        round = cards
        results.clear()
        flipped = false
        startedAt = System.currentTimeMillis()
    }

    LaunchedEffect(isFolder, id) {
        io { if (isFolder) Db.getFolder(id)?.let { it.name to it.color } else Db.getDeck(id)?.let { it.name to it.folderColor } }
            ?.let { title = it.first; folderColor = it.second }
        start(draw())
    }

    val cards = round
    val color = theme.deckColor(folderColor)
    val back = { nav.popBackStack(); Unit }
    if (cards == null) return DetailScreen(title, back, color) { Loading() }
    if (cards.isEmpty()) return DetailScreen(title, back, color) { Empty(tr(R.string.deck_noCards)) }

    val finished = results.size == cards.size
    LaunchedEffect(finished) {
        if (!finished) return@LaunchedEffect
        val snapshot = results.toList()
        // History is per deck, so a folder session is saved as one entry for each deck it touched.
        io {
            val endedAt = System.currentTimeMillis()
            for ((deckId, rs) in snapshot.groupBy { it.card.deckId }) {
                Db.saveSession(deckId, startedAt, endedAt, rs.count { it.correct }, rs.count { !it.correct })
            }
            Db.recordAnswers(snapshot.map { it.card.id to it.correct })
        }
    }

    if (finished) {
        return DetailScreen(title, back, color) {
            Recap(results, onRestart = { missed ->
                if (missed != null) start(drawCards(missed, { it.id }, emptyMap(), 0)) else scope.launch { start(draw()) }
            }, onDone = back)
        }
    }

    val card = cards[results.size]
    fun record(correct: Boolean) {
        haptic.performHapticFeedback(if (correct) HapticFeedbackType.Confirm else HapticFeedbackType.Reject)
        results.add(Result(card, correct))
        flipped = false
    }
    DetailScreen(title, back, color, scroll = false) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            T("${results.size + 1} / ${cards.size}", variant = TextVariant.Label, color = color)
            T(tr(R.string.session_swipeHint), variant = TextVariant.Caption)
        }
        Box(Modifier.fillMaxWidth().height(6.dp).background(theme.muted, RoundedCornerShape(3.dp))) {
            Box(Modifier.fillMaxWidth(results.size / cards.size.toFloat()).fillMaxHeight().background(color, RoundedCornerShape(3.dp)))
        }
        androidx.compose.runtime.key(card.id, results.size) {
            SwipeCard(card, color, flipped, { haptic.performHapticFeedback(HapticFeedbackType.SegmentTick); flipped = !flipped }, ::record, Modifier.weight(1f))
        }
        // Buttons follow the swipe directions: correct on the left, missed on the right.
        Row(Modifier.fillMaxWidth().navigationBarsPadding(), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            AppButton(tr(R.string.session_gotIt), Ic.check, { record(true) }, Modifier.weight(1f), container = theme.success)
            AppButton(
                null, Ic.undo, { haptic.performHapticFeedback(HapticFeedbackType.SegmentTick); results.removeLastOrNull(); flipped = false },
                Modifier.width(56.dp), ButtonVariant.Secondary, enabled = results.isNotEmpty(),
            )
            AppButton(tr(R.string.session_missed), Ic.wrong, { record(false) }, Modifier.weight(1f), container = theme.danger)
        }
    }
}

@Composable
private fun SwipeCard(card: Card, color: Color, flipped: Boolean, onFlip: () -> Unit, onSwipe: (Boolean) -> Unit, modifier: Modifier) {
    val theme = LocalTheme.current
    val tr = LocalTr.current
    val density = LocalDensity.current
    val threshold = with(density) { SWIPE_THRESHOLD.toPx() }
    val screenWidth = LocalConfiguration.current.screenWidthDp * density.density
    val x = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val shape = RoundedCornerShape(Radius.lg)

    // The gesture modifiers come before graphicsLayer so drags are measured in the untransformed space.
    Box(
        modifier.fillMaxSize()
            .pointerInput(Unit) { detectTapGestures { onFlip() } }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        val dx = x.value
                        scope.launch {
                            if (abs(dx) > threshold) {
                                // Swipe left = correct, swipe right = missed.
                                x.animateTo(sign(dx) * screenWidth * 1.3f, tween(180))
                                onSwipe(dx < 0)
                            } else x.animateTo(0f)
                        }
                    },
                    onDragCancel = { scope.launch { x.animateTo(0f) } },
                    onHorizontalDrag = { change, amount -> change.consume(); scope.launch { x.snapTo(x.value + amount) } },
                )
            }
            .graphicsLayer { translationX = x.value; rotationZ = x.value / density.density / 25f },
    ) {
        // ponytail: faces don't scroll; very long cards get clipped. Add a scrollable face if needed.
        Crossfade(flipped, animationSpec = tween(200), label = "flip") { back ->
            Box(
                Modifier.fillMaxSize().clip(shape).background(if (back) color.alpha(0.08f) else theme.surface)
                    .border(1.5.dp, color.alpha(0.5f), shape).padding(Spacing.xl),
                contentAlignment = Alignment.Center,
            ) {
                Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().height(6.dp).background(color))
                if (back) MathMarkdown(answerSource(card.front, card.back), center = true, fontSize = 18)
                else {
                    MathMarkdown(if (isCloze(card.front)) renderCloze(card.front, false) else card.front, center = true, fontSize = 20)
                    T(tr(R.string.session_tapToFlip), Modifier.align(Alignment.BottomCenter), TextVariant.Caption)
                }
            }
        }
        // Each stamp sits on the trailing edge of the swipe so it stays on screen, away from the thumb.
        Stamp(Modifier.align(Alignment.TopEnd), Ic.correct, tr(R.string.session_gotIt), theme.success) { (-x.value / threshold).coerceIn(0f, 1f) }
        Stamp(Modifier.align(Alignment.TopStart), Ic.wrong, tr(R.string.session_missed), theme.danger) { (x.value / threshold).coerceIn(0f, 1f) }
    }
}

@Composable
private fun Stamp(modifier: Modifier, icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, color: Color, alpha: () -> Float) {
    Row(
        modifier.padding(Spacing.lg).graphicsLayer { this.alpha = alpha() }.border(2.dp, color, RoundedCornerShape(Radius.sm))
            .padding(horizontal = Spacing.md, vertical = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Icon(icon, null, tint = color)
        T(text, variant = TextVariant.Heading, color = color)
    }
}

/** "Review missed" replays only those cards (`onRestart(missed)`); "new session" draws again (`onRestart(null)`). */
@Composable
private fun ColumnScope.Recap(results: SnapshotStateList<Result>, onRestart: (List<Card>?) -> Unit, onDone: () -> Unit) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val missed = results.filter { !it.correct }.map { it.card }
    val correct = results.size - missed.size
    val pct = Math.round(correct * 100.0 / results.size).toInt()
    val tint = if (pct >= 80) theme.success else if (pct >= 50) theme.warning else theme.danger

    Surface(Modifier.fillMaxWidth(), tint = tint) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            T(tr(R.string.session_complete), variant = TextVariant.Caption)
            T("$pct%", variant = TextVariant.Title, color = tint)
            T(tr(R.string.session_score, "correct" to correct, "missed" to missed.size))
        }
    }
    if (missed.isNotEmpty()) AppButton(tr(R.string.session_reviewMissed, "count" to missed.size), Ic.replay, { onRestart(missed) }, Modifier.fillMaxWidth())
    AppButton(tr(R.string.session_restart), Ic.study, { onRestart(null) }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
    AppButton(tr(R.string.common_done), Ic.done, onDone, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
    if (missed.isNotEmpty()) T(tr(R.string.session_missedCards), variant = TextVariant.Label)
    for (c in missed) ListRow(stripCloze(c.front), stripCloze(c.back))
}
