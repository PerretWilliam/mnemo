package com.perretwilliam.flashcards.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Immutable
class Theme(
    val text: Color,
    val textSecondary: Color,
    val background: Color,
    val surface: Color,
    val border: Color,
    val muted: Color,
    val primary: Color,
    val primarySoft: Color,
    val onPrimary: Color,
    val accent: Color,
    val success: Color,
    val danger: Color,
    val warning: Color,
    val highlight: Color,
)

private fun c(hex: String) = Color(android.graphics.Color.parseColor(hex))

val LightTheme = Theme(
    text = c("#16142B"), textSecondary = c("#625F7A"), background = c("#F5F4FF"), surface = c("#FFFFFF"),
    border = c("#E4E2F3"), muted = c("#EDEBFA"), primary = c("#4F46E5"), primarySoft = c("#E0E7FF"),
    onPrimary = c("#FFFFFF"), accent = c("#9333EA"), success = c("#16A34A"), danger = c("#DC2626"),
    warning = c("#D97706"), highlight = c("#FDE68A"),
)

val DarkTheme = Theme(
    text = c("#F1F0FA"), textSecondary = c("#A4A1BC"), background = c("#0F0E17"), surface = c("#1B1A27"),
    border = c("#2D2B3D"), muted = c("#262436"), primary = c("#8B93FF"), primarySoft = c("#2A2A5A"),
    onPrimary = c("#0F0E17"), accent = c("#C084FC"), success = c("#4ADE80"), danger = c("#F87171"),
    warning = c("#FBBF24"), highlight = c("#854D0E"),
)

val LocalTheme = staticCompositionLocalOf { LightTheme }

/** `#RRGGBB` folder/stat color to a Compose color. */
fun hex(value: String) = c(value)

/** A deck takes its folder's color; unfiled decks use the app's primary color. */
fun Theme.deckColor(folderColor: String?) = folderColor?.let(::hex) ?: primary

/** Tinted backgrounds. */
fun Color.alpha(a: Float) = copy(alpha = a)

object Spacing {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
}

object Radius {
    val sm = 8.dp
    val md = 12.dp
    val lg = 20.dp
}

@Composable
fun MnemoTheme(content: @Composable () -> Unit) {
    val t = if (isSystemInDarkTheme()) DarkTheme else LightTheme
    val scheme = (if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()).copy(
        primary = t.primary, onPrimary = t.onPrimary, primaryContainer = t.primarySoft, onPrimaryContainer = t.primary,
        secondaryContainer = t.primarySoft, onSecondaryContainer = t.primary,
        background = t.background, onBackground = t.text,
        surface = t.surface, onSurface = t.text, surfaceVariant = t.muted, onSurfaceVariant = t.textSecondary,
        surfaceContainer = t.surface, surfaceContainerLow = t.surface, surfaceContainerHigh = t.surface,
        outline = t.border, outlineVariant = t.border, error = t.danger,
    )
    MaterialTheme(colorScheme = scheme) {
        CompositionLocalProvider(LocalTheme provides t, content = content)
    }
}
