package com.perretwilliam.flashcards

import android.content.res.Resources
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import com.perretwilliam.flashcards.lib.interpolate

/**
 * Looks up Android string resources and fills `{name}` placeholders (the same syntax the strings
 * had before the native rewrite). Usable outside composition, e.g. in coroutines.
 */
class Translator(private val res: Resources) {
    operator fun invoke(@StringRes id: Int, vararg params: Pair<String, Any>): String =
        interpolate(res.getString(id), params.toMap())

    /** Plural form for `count`; `{count}` is filled automatically. */
    fun plural(@PluralsRes id: Int, count: Int, vararg params: Pair<String, Any>): String =
        interpolate(res.getQuantityString(id, count), mapOf<String, Any>("count" to count) + params)
}

val LocalTr = compositionLocalOf<Translator> { error("No Translator provided") }

@Composable
fun rememberTranslator(): Translator {
    val context = LocalContext.current
    val config = LocalConfiguration.current // a language change gives a new configuration
    return remember(config) { Translator(context.resources) }
}
