// Import / export flows: file picker result, clipboard and share sheet, with user prompts.
package com.perretwilliam.flashcards

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.perretwilliam.flashcards.data.ConflictChoice
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.io
import com.perretwilliam.flashcards.lib.Issue
import com.perretwilliam.flashcards.lib.IssueCode
import com.perretwilliam.flashcards.lib.parseExchange
import com.perretwilliam.flashcards.lib.toJson
import com.perretwilliam.flashcards.ui.DialogButton
import com.perretwilliam.flashcards.ui.alert
import com.perretwilliam.flashcards.ui.ask
import java.io.File
import java.time.LocalDate

private const val MAX_LISTED_ERRORS = 8

private fun issueString(code: IssueCode) = when (code) {
    IssueCode.INVALID_JSON -> R.string.issue_invalidJson
    IssueCode.ROOT_OBJECT -> R.string.issue_rootObject
    IssueCode.VERSION -> R.string.issue_version
    IssueCode.DECKS_ARRAY -> R.string.issue_decksArray
    IssueCode.DECK_NAME -> R.string.issue_deckName
    IssueCode.CARDS_ARRAY -> R.string.issue_cardsArray
    IssueCode.DECK_FOLDER -> R.string.issue_deckFolder
    IssueCode.FOLDERS_ARRAY -> R.string.issue_foldersArray
    IssueCode.FOLDER_ENTRY -> R.string.issue_folderEntry
    IssueCode.FRONT -> R.string.issue_front
    IssueCode.BACK_TYPE -> R.string.issue_backType
    IssueCode.TAGS -> R.string.issue_tags
    IssueCode.BACK_REQUIRED -> R.string.issue_backRequired
    IssueCode.HISTORY_ARRAY -> R.string.issue_historyArray
    IssueCode.HISTORY_ENTRY -> R.string.issue_historyEntry
    IssueCode.REPAIRED_BACKSLASHES -> R.string.issue_repairedBackslashes
    IssueCode.RESTORED_LATEX -> R.string.issue_restoredLatex
}

private fun listIssues(tr: Translator, issues: List<Issue>): String {
    val lines = issues.take(MAX_LISTED_ERRORS).map { tr(issueString(it.code), *it.params.toList().toTypedArray()) }.toMutableList()
    if (issues.size > MAX_LISTED_ERRORS) lines += tr(R.string.import_more, "count" to issues.size - MAX_LISTED_ERRORS)
    return lines.joinToString("\n")
}

/** Validates, asks about errors and name conflicts, then imports. Returns true if something was imported. */
suspend fun importText(tr: Translator, text: String): Boolean {
    val ok = tr(R.string.common_ok)
    val parsed = parseExchange(text)
    val data = parsed.data
    if (data == null) {
        alert(tr(R.string.import_nothing), listIssues(tr, parsed.errors), ok)
        return false
    }
    if (parsed.errors.isNotEmpty()) {
        val validCards = data.decks.sumOf { it.cards.size }
        val go = ask(
            tr.plural(R.plurals.import_problems, parsed.errors.size),
            "${listIssues(tr, parsed.errors)}\n\n${tr.plural(R.plurals.import_validAnyway, validCards)}",
            DialogButton(tr(R.string.common_cancel), false),
            DialogButton(tr(R.string.import_importValid), true),
        )
        if (!go) return false
    }
    val result = Db.importExchange(data) { name ->
        ask(
            tr(R.string.import_exists), tr(R.string.import_existsText, "name" to name),
            DialogButton(tr(R.string.import_skip), ConflictChoice.SKIP),
            DialogButton(tr(R.string.import_createNew), ConflictChoice.NEW),
            DialogButton(tr(R.string.import_merge), ConflictChoice.MERGE),
        )
    }
    val summary = tr(R.string.import_summary, "decks" to result.decks, "cards" to result.cards)
    alert(tr(R.string.import_done), if (parsed.warnings.isEmpty()) summary else "$summary\n\n${listIssues(tr, parsed.warnings)}", ok)
    return result.decks > 0
}

suspend fun importFromUri(context: Context, tr: Translator, uri: android.net.Uri): Boolean {
    val text = io { context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() } }
    return importText(tr, text)
}

suspend fun importFromClipboard(context: Context, tr: Translator): Boolean {
    val clip = (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).primaryClip
    val text = clip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
    if (text.isBlank()) {
        alert(tr(R.string.import_clipboardEmpty), tr(R.string.import_clipboardEmptyText), tr(R.string.common_ok))
        return false
    }
    return importText(tr, text)
}

/** Writes the export to the cache directory and opens the share sheet. */
suspend fun exportToFile(context: Context, tr: Translator, withHistory: Boolean) {
    val file = io {
        val dir = File(context.cacheDir, "exports").also { it.mkdirs() }
        File(dir, "mnemo-${if (withHistory) "backup" else "decks"}-${LocalDate.now()}.json").also {
            it.writeText(Db.exportExchange(withHistory).toJson())
        }
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/json"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(send, tr(R.string.export_dialogTitle)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}
