package com.perretwilliam.flashcards.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import com.perretwilliam.flashcards.LocalTr
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.importFromClipboard
import com.perretwilliam.flashcards.lib.CardTypes
import com.perretwilliam.flashcards.lib.PromptOptions
import com.perretwilliam.flashcards.lib.buildPrompt
import com.perretwilliam.flashcards.ui.AppButton
import com.perretwilliam.flashcards.ui.ButtonVariant
import com.perretwilliam.flashcards.ui.DetailScreen
import com.perretwilliam.flashcards.ui.Ic
import com.perretwilliam.flashcards.ui.Input
import com.perretwilliam.flashcards.ui.LocalTheme
import com.perretwilliam.flashcards.ui.Segmented
import com.perretwilliam.flashcards.ui.Select
import com.perretwilliam.flashcards.ui.Spacing
import com.perretwilliam.flashcards.ui.Surface
import com.perretwilliam.flashcards.ui.T
import com.perretwilliam.flashcards.ui.TextVariant
import com.perretwilliam.flashcards.ui.alert
import com.perretwilliam.flashcards.ui.launchSafe
import kotlinx.coroutines.CancellationException

/** Languages offered for AI-generated cards: the value goes into the prompt (always in English), the label is shown. */
private class CardLanguage(val value: String, val label: String, val code: String? = null)

private val CARD_LANGUAGES = listOf(
    CardLanguage("English", "English", "en"), CardLanguage("French", "Français", "fr"),
    CardLanguage("Spanish", "Español", "es"), CardLanguage("German", "Deutsch", "de"),
    CardLanguage("Italian", "Italiano"), CardLanguage("Portuguese", "Português"), CardLanguage("Dutch", "Nederlands"),
    CardLanguage("Polish", "Polski"), CardLanguage("Turkish", "Türkçe"), CardLanguage("Russian", "Русский"),
    CardLanguage("Arabic", "العربية"), CardLanguage("Chinese", "中文"), CardLanguage("Japanese", "日本語"), CardLanguage("Korean", "한국어"),
)

@Composable
fun AiPromptScreen(nav: NavHostController) {
    val tr = LocalTr.current
    val theme = LocalTheme.current
    val context: Context = LocalContext.current
    val scope = rememberCoroutineScope()
    val appLanguage = LocalConfiguration.current.locales[0]?.language
    var topic by remember { mutableStateOf("") }
    var deckName by remember { mutableStateOf("") }
    var folder by remember { mutableStateOf("") }
    var count by remember { mutableStateOf("20") }
    var types by remember { mutableStateOf(CardTypes.BOTH) }
    // Default to the app language.
    var language by remember { mutableStateOf(CARD_LANGUAGES.find { it.code == appLanguage }?.value ?: "English") }
    var notes by remember { mutableStateOf("") }

    val n = count.toIntOrNull() ?: 0
    val ready = topic.isNotBlank() && deckName.isNotBlank() && n in 1..200
    fun prompt() = buildPrompt(PromptOptions(topic.trim(), deckName.trim(), folder, n, types, language, notes))

    DetailScreen(tr(R.string.ai_title), { nav.popBackStack() }) {
        Input(topic, { topic = it }, label = tr(R.string.ai_topic), placeholder = tr(R.string.ai_topicPlaceholder))
        Input(deckName, { deckName = it }, label = tr(R.string.ai_deckName), placeholder = tr(R.string.ai_deckPlaceholder))
        Input(folder, { folder = it }, label = tr(R.string.ai_folder), placeholder = tr(R.string.ai_folderPlaceholder))
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            Select(language, CARD_LANGUAGES.map { it.value to it.label }, { language = it }, label = tr(R.string.ai_language))
            Input(count, { count = it.filter(Char::isDigit) }, Modifier.weight(1f), label = tr(R.string.ai_count))
        }
        T(tr(R.string.ai_types), variant = TextVariant.Label)
        Segmented(
            types,
            listOf(CardTypes.QA to tr(R.string.ai_typeQa), CardTypes.CLOZE to tr(R.string.ai_typeCloze), CardTypes.BOTH to tr(R.string.ai_typeBoth)),
        ) { types = it }
        Input(notes, { notes = it }, label = tr(R.string.ai_notes), placeholder = tr(R.string.ai_notesPlaceholder), multiline = true)
        AppButton(
            tr(R.string.ai_copy), Ic.copy,
            {
                (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("prompt", prompt()))
                scope.launchSafe(tr) { alert(tr(R.string.ai_copiedTitle), tr(R.string.ai_copiedText), tr(R.string.common_ok)) }
            },
            Modifier.fillMaxWidth(), enabled = ready,
        )
        AppButton(
            tr(R.string.ai_share), Ic.share,
            {
                val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, prompt()) }
                context.startActivity(Intent.createChooser(send, null))
            },
            Modifier.fillMaxWidth(), ButtonVariant.Secondary, enabled = ready,
        )
        Surface(tint = theme.accent) {
            T(tr(R.string.ai_then), variant = TextVariant.Heading, color = theme.accent)
            T(tr(R.string.ai_thenText), variant = TextVariant.Caption)
            AppButton(
                tr(R.string.ai_import), Ic.paste,
                {
                    scope.launchSafe(tr) {
                        try {
                            if (importFromClipboard(context, tr)) nav.popBackStack()
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            alert(tr(R.string.ai_importFailed), e.message.orEmpty(), tr(R.string.common_ok))
                        }
                    }
                },
                Modifier.fillMaxWidth(),
            )
        }
    }
}
