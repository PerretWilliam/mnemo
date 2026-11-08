package com.perretwilliam.flashcards.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CompletableDeferred

class DialogButton<V>(val text: String, val value: V, val destructive: Boolean = false)

private class Pending(val title: String, val message: String, val buttons: List<DialogButton<Any?>>, val result: CompletableDeferred<Any?>)

private var pending by mutableStateOf<Pending?>(null)

/**
 * Suspends until the user taps a button. The first button is the cancel button: it is also the
 * result when the dialog is dismissed. Needs [DialogHost] somewhere in the composition.
 */
@Suppress("UNCHECKED_CAST")
suspend fun <V> ask(title: String, message: String, vararg buttons: DialogButton<V>): V {
    val result = CompletableDeferred<Any?>()
    pending = Pending(title, message, buttons.toList() as List<DialogButton<Any?>>, result)
    try {
        return result.await() as V
    } finally {
        pending = null
    }
}

/** Plain message with an OK button. */
suspend fun alert(title: String, message: String, ok: String) = ask(title, message, DialogButton(ok, Unit))

/** Destructive confirmation; true when the user chose the action. Labels come from the caller so they are translated. */
suspend fun confirm(title: String, message: String, cancel: String, action: String) =
    ask(title, message, DialogButton(cancel, false), DialogButton(action, true, destructive = true))

@Composable
fun DialogHost() {
    val p = pending ?: return
    val theme = LocalTheme.current
    AlertDialog(
        onDismissRequest = { p.result.complete(p.buttons.first().value) },
        title = { Text(p.title) },
        text = { Text(p.message) },
        // Material puts the confirm slot on the right: the cancel button goes in the dismiss slot, the rest in confirm.
        dismissButton = if (p.buttons.size > 1) {
            { TextButton({ p.result.complete(p.buttons.first().value) }) { Text(p.buttons.first().text) } }
        } else null,
        confirmButton = {
            for (b in p.buttons.drop(if (p.buttons.size > 1) 1 else 0)) {
                TextButton({ p.result.complete(b.value) }) { Text(b.text, color = if (b.destructive) theme.danger else theme.primary) }
            }
        },
        containerColor = theme.surface,
    )
}
