// Multiple-choice mode UI: the options (Settings and the in-session sheet) and the question screen.
package com.perretwilliam.flashcards.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.data.Prefs
import com.perretwilliam.flashcards.lib.MCQ_CHOICE_COUNTS
import com.perretwilliam.flashcards.lib.MCQ_TIMERS
import com.perretwilliam.flashcards.lib.McqConfig
import com.perretwilliam.flashcards.lib.McqQuestion
import com.perretwilliam.flashcards.lib.StudyMode
import com.perretwilliam.flashcards.lib.gradeMcq
import com.perretwilliam.flashcards.lib.isPlainText
import com.perretwilliam.flashcards.lib.pickedText
import com.perretwilliam.flashcards.ui.AppButton
import com.perretwilliam.flashcards.ui.Ic
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.MathMarkdown
import com.perretwilliam.flashcards.ui.Radius
import com.perretwilliam.flashcards.ui.Segmented
import com.perretwilliam.flashcards.ui.Select
import com.perretwilliam.flashcards.ui.Spacing
import com.perretwilliam.flashcards.ui.Surface
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.Toggle
import com.perretwilliam.flashcards.ui.alpha
import kotlinx.coroutines.delay

private const val AUTO_NEXT_MS = 900L

/** Flashcards | MCQ switch. */
@Composable
fun ModeSwitch(mode: StudyMode, onChange: (StudyMode) -> Unit) {
    val tr = LocalTr.current
    Segmented(mode, listOf(StudyMode.CARDS to tr(R.string.study_modeCards), StudyMode.MCQ to tr(R.string.study_modeMcq)), onChange)
}

/** Every multiple-choice setting. Stateless: the caller keeps the config and persists it. */
@Composable
fun McqOptions(cfg: McqConfig, onChange: (McqConfig) -> Unit) {
    val tr = LocalTr.current
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.lg)) {
        Select(cfg.choices, MCQ_CHOICE_COUNTS.map { it to it.toString() }, { onChange(cfg.copy(choices = it)) }, label = tr(R.string.mcq_choices))
        Select(
            cfg.timerSec, MCQ_TIMERS.map { it to if (it == 0) tr(R.string.mcq_timerOff) else tr(R.string.mcq_timerValue, "count" to it) },
            { onChange(cfg.copy(timerSec = it)) }, label = tr(R.string.mcq_timer),
        )
        Toggle(tr(R.string.mcq_generate), cfg.generate, { onChange(cfg.copy(generate = it)) }, tr(R.string.mcq_generateHint))
        Toggle(tr(R.string.mcq_shuffle), cfg.shuffle, { onChange(cfg.copy(shuffle = it)) }, tr(R.string.mcq_shuffleHint))
        Toggle(tr(R.string.mcq_instant), cfg.instant, { onChange(cfg.copy(instant = it)) }, tr(R.string.mcq_instantHint))
        Toggle(tr(R.string.mcq_explain), cfg.explain, { onChange(cfg.copy(explain = it)) }, tr(R.string.mcq_explainHint), enabled = cfg.instant)
        Toggle(tr(R.string.mcq_autoNext), cfg.autoNext, { onChange(cfg.copy(autoNext = it)) }, tr(R.string.mcq_autoNextHint), enabled = cfg.instant)
    }
}

/** Mode and options, saved as they change. `onDismiss(changed)` tells the session whether it must restart. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudyOptionsSheet(onDismiss: (changed: Boolean) -> Unit) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    var mode by remember { mutableStateOf(Prefs.studyMode) }
    var cfg by remember { mutableStateOf(Prefs.mcq) }
    val initial = remember { mode to cfg }
    ModalBottomSheet(onDismissRequest = { onDismiss((mode to cfg) != initial) }, containerColor = theme.surface) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(horizontal = Spacing.lg).padding(bottom = Spacing.xl),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            T(tr(R.string.study_options), variant = TextVariant.Heading)
            ModeSwitch(mode) { mode = it; Prefs.studyMode = it }
            if (mode == StudyMode.MCQ) McqOptions(cfg) { cfg = it; Prefs.mcq = it }
            T(tr(R.string.study_optionsRestart), variant = TextVariant.Caption)
        }
    }
}

private enum class OptionState { Idle, Selected, Correct, Wrong, Missed }

/**
 * One question. Single answer: tapping an option answers. Several correct options: tick them, then check.
 * With instant feedback the result is shown until "Next"; without it the question is left right away.
 * `onResult(correct, pickedText)` is called once, when the user moves on.
 */
@Composable
fun McqPlay(q: McqQuestion, cfg: McqConfig, color: Color, onResult: (correct: Boolean, picked: String?) -> Unit, modifier: Modifier = Modifier) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val haptic = LocalHapticFeedback.current
    var picked by remember { mutableStateOf(emptySet<Int>()) }
    var revealed by remember { mutableStateOf(false) }
    var timedOut by remember { mutableStateOf(false) }
    val timeLeft = remember { Animatable(1f) }
    val correct = !timedOut && gradeMcq(q, picked)

    fun finish(selection: Set<Int>, late: Boolean) {
        picked = selection
        timedOut = late
        val good = !late && gradeMcq(q, selection)
        haptic.performHapticFeedback(if (good) HapticFeedbackType.Confirm else HapticFeedbackType.Reject)
        if (cfg.instant) revealed = true else onResult(good, pickedText(q, selection))
    }

    LaunchedEffect(revealed) {
        if (cfg.timerSec > 0 && !revealed) {
            timeLeft.animateTo(0f, tween(cfg.timerSec * 1000, easing = LinearEasing))
            finish(picked, true)
        }
    }
    LaunchedEffect(revealed) {
        if (revealed && cfg.autoNext && correct) {
            delay(AUTO_NEXT_MS)
            onResult(true, pickedText(q, picked))
        }
    }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        if (cfg.timerSec > 0) {
            val urgent = timeLeft.value < 0.25f && !revealed
            Box(Modifier.fillMaxWidth().height(4.dp).background(theme.muted, RoundedCornerShape(2.dp))) {
                Box(
                    Modifier.fillMaxWidth(timeLeft.value).fillMaxHeight()
                        .background(if (urgent) theme.danger else theme.textSecondary.alpha(0.5f), RoundedCornerShape(2.dp)),
                )
            }
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
            Surface(tint = color) {
                MathMarkdown(q.prompt, fontSize = 19)
                if (q.multi && !revealed) T(tr(R.string.mcq_selectAll), variant = TextVariant.Caption)
            }
            q.options.forEachIndexed { i, option ->
                val state = when {
                    !revealed -> if (i in picked) OptionState.Selected else OptionState.Idle
                    option.correct -> if (i in picked) OptionState.Correct else OptionState.Missed
                    i in picked -> OptionState.Wrong
                    else -> OptionState.Idle
                }
                OptionRow(
                    ('A' + i).toString(), option.text, state,
                    onClick = if (revealed) null else ({ if (q.multi) picked = if (i in picked) picked - i else picked + i else finish(setOf(i), false) }),
                )
            }
            if (revealed && timedOut) T(tr(R.string.mcq_timeUp), color = theme.danger)
            if (revealed && cfg.explain && q.explanation.isNotBlank()) Surface {
                T(tr(R.string.mcq_explanation), variant = TextVariant.Label)
                MathMarkdown(q.explanation, fontSize = 16)
            }
        }
        Box(Modifier.fillMaxWidth().navigationBarsPadding()) {
            when {
                revealed -> AppButton(tr(R.string.mcq_next), Ic.study, { onResult(correct, pickedText(q, picked)) }, Modifier.fillMaxWidth())
                q.multi -> AppButton(tr(R.string.mcq_check), Ic.check, { finish(picked, false) }, Modifier.fillMaxWidth(), enabled = picked.isNotEmpty())
            }
        }
    }
}

@Composable
private fun OptionRow(letter: String, text: String, state: OptionState, onClick: (() -> Unit)?) {
    val theme = LocalTheme.current
    val tint = when (state) {
        OptionState.Selected -> theme.primary
        OptionState.Correct, OptionState.Missed -> theme.success
        OptionState.Wrong -> theme.danger
        OptionState.Idle -> null
    }
    val shape = RoundedCornerShape(Radius.md)
    val faded = state == OptionState.Missed
    Row(
        Modifier.fillMaxWidth().clip(shape)
            .background(tint?.alpha(if (faded) 0.06f else 0.14f) ?: theme.surface)
            .border(if (tint != null) 1.5.dp else 0.5.dp, tint?.alpha(if (faded) 0.5f else 1f) ?: theme.border, shape)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(Spacing.md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(28.dp).background((tint ?: theme.textSecondary).alpha(0.16f), RoundedCornerShape(Radius.sm)), contentAlignment = Alignment.Center) {
            T(letter, variant = TextVariant.Label, color = tint ?: theme.textSecondary)
        }
        // Only options with Markdown or math pay for a WebView.
        Box(Modifier.weight(1f)) { if (isPlainText(text)) T(text) else MathMarkdown(text, fontSize = 16) }
        when (state) {
            OptionState.Correct, OptionState.Missed -> Icon(Ic.correct, null, tint = theme.success)
            OptionState.Wrong -> Icon(Ic.wrong, null, tint = theme.danger)
            else -> {}
        }
    }
}
