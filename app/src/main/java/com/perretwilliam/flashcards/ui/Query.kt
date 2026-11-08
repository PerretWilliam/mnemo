package com.perretwilliam.flashcards.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import com.perretwilliam.flashcards.R
import com.perretwilliam.flashcards.Translator
import com.perretwilliam.flashcards.data.Db
import com.perretwilliam.flashcards.data.io
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/** Runs [block] off the main thread; re-runs after every database write or when [keys] change. `null` while loading. */
@Composable
fun <T> rememberQuery(vararg keys: Any?, block: () -> T): State<T?> {
    val version by Db.version.collectAsState()
    return produceState<T?>(null, version, *keys) { value = io(block) }
}

/** Launches [block]; an unexpected failure (unreadable file, share error...) is shown instead of crashing. */
fun CoroutineScope.launchSafe(tr: Translator, block: suspend () -> Unit): Job = launch {
    try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        alert(tr(R.string.common_somethingWrong), e.message ?: e.toString(), tr(R.string.common_ok))
    }
}
