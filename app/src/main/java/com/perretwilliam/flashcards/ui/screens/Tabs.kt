package com.perretwilliam.flashcards.ui.screens

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.core.os.LocaleListCompat
import androidx.navigation.NavHostController
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.Folder
import com.perretwilliam.flashcards.data.Prefs
import com.perretwilliam.flashcards.data.io
import com.perretwilliam.flashcards.exportToFile
import com.perretwilliam.flashcards.importFromClipboard
import com.perretwilliam.flashcards.importFromUri
import com.perretwilliam.flashcards.lib.dailyReviews
import com.perretwilliam.flashcards.lib.groupByFolder
import com.perretwilliam.flashcards.lib.streak
import com.perretwilliam.flashcards.lib.successRate
import com.perretwilliam.flashcards.ui.AppButton
import com.perretwilliam.flashcards.ui.ButtonVariant
import com.perretwilliam.flashcards.ui.Empty
import com.perretwilliam.flashcards.ui.Ic
import com.perretwilliam.flashcards.ui.Input
import com.perretwilliam.flashcards.ui.ListRow
import com.perretwilliam.flashcards.ui.Loading
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.Screen
import com.perretwilliam.flashcards.ui.Select
import com.perretwilliam.flashcards.ui.Spacing
import com.perretwilliam.flashcards.ui.Surface
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.alert
import com.perretwilliam.flashcards.ui.alpha
import com.perretwilliam.flashcards.ui.confirm
import com.perretwilliam.flashcards.ui.deckColor
import com.perretwilliam.flashcards.ui.hex
import com.perretwilliam.flashcards.ui.launchSafe
import com.perretwilliam.flashcards.ui.openDeck
import com.perretwilliam.flashcards.ui.openFolder
import com.perretwilliam.flashcards.ui.rememberQuery
import com.perretwilliam.flashcards.ui.study
import com.perretwilliam.flashcards.ui.studyFolder
import java.text.DateFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Date

private const val DAYS = 7
private val BAR_HEIGHT = 96.dp

private val locale @Composable get() = LocalConfiguration.current.locales[0]!!

@Composable
fun HomeScreen(nav: NavHostController) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val locale = locale
    val haptic = LocalHapticFeedback.current
    var selected by remember { mutableIntStateOf(DAYS - 1) } // index into the days; today by default
    val data by rememberQuery { Db.listDecks() to Db.listSessions(-1) }
    val (decks, sessions) = data ?: return Loading()

    val days = dailyReviews(sessions, DAYS)
    val max = maxOf(1, days.maxOf { it.count })
    val rate = successRate(sessions)
    val lastByDeck = HashMap<Long, Long>()
    for (s in sessions) lastByDeck.putIfAbsent(s.deckId, s.endedAt) // sessions are newest first
    // Least recently studied decks first: that's what to review next.
    val nextUp = decks.filter { it.cardCount > 0 }.sortedBy { lastByDeck[it.id] ?: 0L }.take(3)

    Screen("Mnemo") {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Stat(Modifier.weight(1f), Ic.decks, tr(R.string.dash_decks), decks.size.toString(), hex("#6366F1"))
            Stat(Modifier.weight(1f), Ic.cards, tr(R.string.dash_cards), decks.sumOf { it.cardCount }.toString(), hex("#EC4899"))
            Stat(Modifier.weight(1f), Ic.streak, tr(R.string.dash_streak), tr(R.string.dash_streakValue, "count" to streak(sessions)), hex("#F59E0B"))
            Stat(Modifier.weight(1f), Ic.success, tr(R.string.dash_success), rate?.let { "$it%" } ?: "–", hex("#10B981"))
        }

        Surface {
            T(tr(R.string.dash_lastDays, "count" to DAYS), variant = TextVariant.Heading)
            Row(Modifier.fillMaxWidth().height(BAR_HEIGHT + 40.dp), horizontalArrangement = Arrangement.spacedBy(Spacing.sm), verticalAlignment = Alignment.Bottom) {
                days.forEachIndexed { i, d ->
                    val active = i == selected
                    Column(Modifier.weight(1f).clickable { haptic.performHapticFeedback(HapticFeedbackType.SegmentTick); selected = i }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                        T(if (d.count > 0) d.count.toString() else "", variant = TextVariant.Caption, color = if (active) theme.primary else null)
                        Box(
                            Modifier.fillMaxWidth().height(maxOf(4.dp, BAR_HEIGHT * d.count / max))
                                .background(if (d.count == 0) theme.muted else if (active) theme.primary else theme.accent.alpha(0.45f), RoundedCornerShape(4.dp)),
                        )
                        val day = Instant.ofEpochMilli(d.date).atZone(ZoneId.systemDefault()).dayOfWeek.getDisplayName(TextStyle.NARROW, locale)
                        T(day, variant = TextVariant.Caption, color = if (active) theme.primary else null)
                    }
                }
            }
            val day = days[selected]
            HorizontalDivider(color = theme.border)
            val date = DateTimeFormatter.ofPattern("EEEE d MMMM", locale).format(Instant.ofEpochMilli(day.date).atZone(ZoneId.systemDefault()))
            T(date.replaceFirstChar { it.titlecase(locale) }, variant = TextVariant.Label, color = theme.primary)
            if (day.count == 0) T(tr(R.string.dash_dayEmpty), variant = TextVariant.Caption)
            else FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                Figure(Ic.correct, theme.success, tr(R.string.dash_dayCorrect, "count" to day.correct))
                Figure(Ic.wrong, theme.danger, tr(R.string.dash_dayWrong, "count" to day.wrong))
                Figure(Ic.success, theme.primary, "${Math.round(day.correct * 100.0 / day.count)}%")
            }
            T(tr(R.string.dash_tapHint), variant = TextVariant.Caption)
        }

        if (decks.isEmpty()) Surface(tint = theme.primary) {
            T(tr(R.string.dash_getStarted), variant = TextVariant.Heading, color = theme.primary)
            T(tr(R.string.dash_getStartedText), variant = TextVariant.Caption)
            AppButton(tr(R.string.dash_createDeck), onClick = { nav.navigate("decks") }, modifier = Modifier.fillMaxWidth())
            AppButton(tr(R.string.ai_title), onClick = { nav.navigate("ai") }, variant = ButtonVariant.Secondary, modifier = Modifier.fillMaxWidth())
        }

        if (nextUp.isNotEmpty()) T(tr(R.string.dash_studyNext), variant = TextVariant.Heading)
        for (d in nextUp) ListRow(
            d.name,
            subtitle = lastByDeck[d.id]?.let { tr(R.string.dash_lastStudied, "date" to DateFormat.getDateInstance(DateFormat.SHORT, locale).format(Date(it))) }
                ?: tr(R.string.dash_neverStudied),
            right = tr.plural(R.plurals.count_cards, d.cardCount),
            accent = theme.deckColor(d.folderColor),
            onClick = { nav.study(d.id) },
        )
    }
}

@Composable
private fun Figure(icon: ImageVector, color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
        T(text, variant = TextVariant.Label, color = color)
    }
}

@Composable
private fun Stat(modifier: Modifier, icon: ImageVector, label: String, value: String, color: Color) {
    Surface(modifier, tint = color) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
            T(value, variant = TextVariant.Heading, color = color)
            T(label, variant = TextVariant.Caption, maxLines = 1)
        }
    }
}

@Composable
fun DecksScreen(nav: NavHostController) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val scope = rememberCoroutineScope()
    val data by rememberQuery { Db.listDecks() to Db.listFolders() }
    var name by remember { mutableStateOf("") }

    val add = {
        if (name.isNotBlank()) scope.launchSafe(tr) {
            val id = io { Db.createDeck(name) }
            name = ""
            nav.openDeck(id)
        }
        Unit
    }

    Screen(tr(R.string.decks_title)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm), verticalAlignment = Alignment.CenterVertically) {
            Input(name, { name = it }, Modifier.weight(1f), placeholder = tr(R.string.decks_newPlaceholder), onDone = { add() })
            AppButton(tr(R.string.decks_add), Ic.add, onClick = { add() }, enabled = name.isNotBlank())
        }
        AppButton(tr(R.string.decks_newFolder), Ic.folder, { nav.openFolder("new") }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
        AppButton(tr(R.string.decks_generateAi), Ic.ai, { nav.navigate("ai") }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
        val (decks, folders) = data ?: return@Screen
        if (decks.isEmpty() && folders.isEmpty()) Empty(tr(R.string.decks_empty))
        // Headers only make sense once folders exist; without any, the list stays flat.
        for (section in groupByFolder(folders, decks, { it.id }, { it.folderId })) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                if (folders.isNotEmpty()) SectionHeader(nav, section.folder, section.decks.size)
                for (d in section.decks) ListRow(d.name, right = tr.plural(R.plurals.count_cards, d.cardCount), accent = theme.deckColor(d.folderColor), onClick = { nav.openDeck(d.id) })
            }
        }
    }
}

/** Folder title with its color; tapping it opens the folder editor. `folder = null` is the unfiled section. */
@Composable
private fun SectionHeader(nav: NavHostController, folder: Folder?, count: Int) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val color = theme.deckColor(folder?.color)
    Row(Modifier.padding(top = Spacing.sm), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(
            Modifier.weight(1f).then(if (folder != null) Modifier.clickable { nav.openFolder(folder.id.toString()) } else Modifier),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Icon(Ic.folder, null, tint = color, modifier = Modifier.size(20.dp))
            T(folder?.name ?: tr(R.string.decks_unfiled), Modifier.weight(1f, fill = false), TextVariant.Heading, color, maxLines = 1)
            T(tr.plural(R.plurals.count_decks, count), variant = TextVariant.Caption)
            if (folder != null) Icon(Ic.edit, null, tint = theme.textSecondary, modifier = Modifier.size(18.dp))
        }
        if (folder != null && folder.cardCount > 0) {
            Icon(Ic.study, tr(R.string.folder_study), tint = color, modifier = Modifier.size(32.dp).clickable { nav.studyFolder(folder.id) }.padding(Spacing.xs))
        }
    }
}

private fun formatDuration(ms: Long): String {
    val s = Math.round(ms / 1000.0)
    return if (s < 60) "${s}s" else "${s / 60}m ${s % 60}s"
}

@Composable
fun HistoryScreen() {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val locale = locale
    val sessions by rememberQuery { Db.listSessions() }
    Screen(tr(R.string.history_title)) {
        val list = sessions ?: return@Screen
        if (list.isEmpty()) Empty(tr(R.string.history_empty))
        for (s in list) {
            val total = s.correct + s.wrong
            val pct = if (total > 0) Math.round(s.correct * 100.0 / total) else 0
            ListRow(
                s.deckName,
                subtitle = "${DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT, locale).format(Date(s.endedAt))} · ${formatDuration(s.endedAt - s.startedAt)}",
                right = "${s.correct}/$total · $pct%",
                accent = theme.deckColor(s.folderColor),
            )
        }
    }
}

private val LANGUAGES = listOf("en" to "English", "fr" to "Français", "es" to "Español", "de" to "Deutsch")

@Composable
fun SettingsScreen(nav: NavHostController) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val context: Context = LocalContext.current
    val scope = rememberCoroutineScope()
    var size by remember { mutableIntStateOf(Prefs.sessionSize) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launchSafe(tr) { importFromUri(context, tr, uri) }
    }

    val erase = {
        scope.launchSafe(tr) {
            if (!confirm(tr(R.string.settings_eraseTitle), tr(R.string.settings_eraseText), tr(R.string.common_cancel), tr(R.string.common_continue))) return@launchSafe
            if (!confirm(tr(R.string.settings_eraseConfirmTitle), tr(R.string.settings_eraseConfirmText), tr(R.string.common_cancel), tr(R.string.settings_eraseAction))) return@launchSafe
            io { Db.wipeAll() }
            alert(tr(R.string.common_done), tr(R.string.settings_erased), tr(R.string.common_ok))
        }
        Unit
    }

    Screen(tr(R.string.settings_title)) {
        Surface {
            val current = AppCompatDelegate.getApplicationLocales().toLanguageTags().substringBefore('-')
            Select(
                current.takeIf { c -> LANGUAGES.any { it.first == c } } ?: "",
                listOf("" to tr(R.string.settings_languageSystem)) + LANGUAGES,
                { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(it)) }, // recreates the activity
                label = tr(R.string.settings_language),
            )
        }
        Surface {
            Select(
                size, Prefs.SESSION_SIZES.map { it to if (it == 0) tr(R.string.settings_sessionAll) else it.toString() },
                { Prefs.sessionSize = it; size = it }, label = tr(R.string.settings_sessionSize),
            )
            T(tr(R.string.settings_sessionSizeHelp), variant = TextVariant.Caption)
        }
        Surface {
            T(tr(R.string.settings_import), variant = TextVariant.Heading)
            T(tr(R.string.settings_importHelp), variant = TextVariant.Caption)
            AppButton(tr(R.string.settings_importFile), Ic.importFile, { picker.launch(arrayOf("application/json", "text/plain", "*/*")) }, Modifier.fillMaxWidth())
            AppButton(tr(R.string.settings_paste), Ic.paste, { scope.launchSafe(tr) { importFromClipboard(context, tr) } }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
            AppButton(tr(R.string.ai_title), Ic.ai, { nav.navigate("ai") }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
        }
        Surface {
            T(tr(R.string.settings_export), variant = TextVariant.Heading)
            AppButton(tr(R.string.settings_exportDecks), Ic.export, { scope.launchSafe(tr) { exportToFile(context, tr, false) } }, Modifier.fillMaxWidth())
            AppButton(tr(R.string.settings_backup), Ic.save, { scope.launchSafe(tr) { exportToFile(context, tr, true) } }, Modifier.fillMaxWidth(), ButtonVariant.Secondary)
        }
        Surface(tint = theme.danger) {
            T(tr(R.string.settings_danger), variant = TextVariant.Heading, color = theme.danger)
            AppButton(tr(R.string.settings_erase), Ic.delete, { erase() }, Modifier.fillMaxWidth(), ButtonVariant.Danger)
        }
        val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName.orEmpty()
        T("Mnemo · ${tr(R.string.settings_version, "version" to version)}", Modifier.fillMaxWidth(), TextVariant.Caption)
    }
}
