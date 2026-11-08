// Small set of themed building blocks shared by all screens (port of the former ui.tsx).
package com.perretwilliam.flashcards.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row as LayoutRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class TextVariant { Title, Heading, Body, Caption, Label }

private fun style(v: TextVariant) = when (v) {
    TextVariant.Title -> TextStyle(fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.ExtraBold)
    TextVariant.Heading -> TextStyle(fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold)
    TextVariant.Body -> TextStyle(fontSize = 16.sp, lineHeight = 22.sp)
    TextVariant.Caption -> TextStyle(fontSize = 13.sp, lineHeight = 18.sp)
    TextVariant.Label -> TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold)
}

@Composable
fun T(text: String, modifier: Modifier = Modifier, variant: TextVariant = TextVariant.Body, color: Color? = null, maxLines: Int = Int.MAX_VALUE) {
    val theme = LocalTheme.current
    val base = if (variant == TextVariant.Caption || variant == TextVariant.Label) theme.textSecondary else theme.text
    Text(text, modifier, color = color ?: base, style = style(variant), maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

/** Scrollable page with an optional large title (tab screens have no app bar). */
@Composable
fun Screen(title: String? = null, content: @Composable ColumnScope.() -> Unit) {
    val theme = LocalTheme.current
    Column(
        Modifier.fillMaxSize().background(theme.background).statusBarsPadding().verticalScroll(rememberScrollState()).padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        if (title != null) T(title, variant = TextVariant.Title, color = theme.primary)
        content()
    }
}

/** Card container; `tint` gives it a soft colored background and border instead of the neutral surface. */
@Composable
fun Surface(modifier: Modifier = Modifier, tint: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val theme = LocalTheme.current
    val bg = tint?.alpha(0.12f) ?: theme.surface
    val border = tint?.alpha(0.35f) ?: theme.border
    Column(
        modifier.fillMaxWidth().background(bg, RoundedCornerShape(Radius.md))
            .border(BorderStroke(0.5.dp, border), RoundedCornerShape(Radius.md)).padding(Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) { content() }
}

enum class ButtonVariant { Primary, Secondary, Danger }

@Composable
fun AppButton(
    title: String? = null,
    icon: ImageVector? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
    container: Color? = null,
) {
    val theme = LocalTheme.current
    val bg = container ?: when (variant) { ButtonVariant.Primary -> theme.primary; ButtonVariant.Danger -> theme.danger; else -> theme.primarySoft }
    val fg = if (variant == ButtonVariant.Secondary) theme.primary else theme.onPrimary
    LayoutRow(
        modifier.heightIn(min = 48.dp).background(bg.copy(alpha = if (enabled) 1f else 0.4f), RoundedCornerShape(Radius.md))
            .clickable(enabled = enabled, onClick = onClick).padding(horizontal = Spacing.lg),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) Icon(icon, null, tint = fg, modifier = Modifier.size(20.dp))
        if (title != null) Text(title, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun Input(
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    multiline: Boolean = false,
    onDone: (() -> Unit)? = null,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        if (label != null) T(label, variant = TextVariant.Label)
        OutlinedTextField(
            value, onChange, Modifier.fillMaxWidth().then(if (multiline) Modifier.heightIn(min = 96.dp) else Modifier),
            placeholder = placeholder?.let { { Text(it) } },
            singleLine = !multiline,
            keyboardOptions = KeyboardOptions(imeAction = if (onDone != null) androidx.compose.ui.text.input.ImeAction.Done else androidx.compose.ui.text.input.ImeAction.Default),
            keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
            shape = RoundedCornerShape(Radius.sm),
        )
    }
}

/** Pressable list row. `accent` tints the `right` badge (e.g. the deck's folder color). */
@Composable
fun ListRow(title: String, subtitle: String? = null, right: String? = null, accent: Color? = null, onClick: (() -> Unit)? = null) {
    val theme = LocalTheme.current
    LayoutRow(
        Modifier.fillMaxWidth().background(theme.surface, RoundedCornerShape(Radius.md))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(Spacing.lg),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            T(title, maxLines = 2)
            if (subtitle != null) T(subtitle, variant = TextVariant.Caption, maxLines = 2)
        }
        if (right != null) {
            val c = accent ?: theme.primary
            Box(Modifier.background(c.alpha(0.14f), RoundedCornerShape(Radius.sm)).padding(horizontal = Spacing.sm, vertical = 2.dp)) {
                T(right, variant = TextVariant.Label, color = c)
            }
        }
    }
}

/** Segmented choice between a few options. */
@Composable
fun <V> Segmented(value: V, options: List<Pair<V, String>>, onChange: (V) -> Unit) {
    val theme = LocalTheme.current
    LayoutRow(Modifier.fillMaxWidth().background(theme.muted, RoundedCornerShape(Radius.sm)).padding(3.dp)) {
        for ((v, label) in options) {
            val active = v == value
            Box(
                Modifier.weight(1f).background(if (active) theme.primary else Color.Transparent, RoundedCornerShape(Radius.sm - 2.dp))
                    .clickable { onChange(v) }.padding(vertical = Spacing.sm),
                contentAlignment = Alignment.Center,
            ) { T(label, variant = TextVariant.Label, color = if (active) theme.onPrimary else theme.textSecondary) }
        }
    }
}

/** Dropdown: a field that opens a list of options in a bottom sheet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <V> Select(value: V, options: List<Pair<V, String>>, onChange: (V) -> Unit, label: String? = null) {
    val theme = LocalTheme.current
    var open by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        if (label != null) T(label, variant = TextVariant.Label)
        LayoutRow(
            Modifier.fillMaxWidth().background(theme.surface, RoundedCornerShape(Radius.sm)).clickable { open = true }
                .padding(horizontal = Spacing.md, vertical = Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            T(options.find { it.first == value }?.second ?: value.toString(), Modifier.weight(1f))
            Icon(Icons.Filled.ExpandMore, null, tint = theme.primary)
        }
    }
    if (open) {
        ModalBottomSheet(onDismissRequest = { open = false }, containerColor = theme.surface) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(bottom = Spacing.xl)) {
                if (label != null) T(label, Modifier.padding(Spacing.lg), variant = TextVariant.Heading)
                for ((v, text) in options) {
                    val selected = v == value
                    LayoutRow(
                        Modifier.fillMaxWidth().background(if (selected) theme.primarySoft else Color.Transparent)
                            .clickable { onChange(v); open = false }.padding(horizontal = Spacing.lg, vertical = Spacing.md + 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        T(text, Modifier.weight(1f), color = if (selected) theme.primary else theme.text)
                        if (selected) Icon(Icons.Filled.Check, null, tint = theme.primary)
                    }
                }
            }
        }
    }
}

@Composable
fun Empty(text: String) {
    T(text, Modifier.fillMaxWidth().padding(vertical = Spacing.xxl), variant = TextVariant.Caption)
}

@Composable
fun Loading() {
    Box(Modifier.fillMaxSize().background(LocalTheme.current.background), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = LocalTheme.current.primary)
    }
}

/** Page with a back arrow and a title (all screens outside the bottom tabs). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(title: String, onBack: () -> Unit, tint: Color? = null, scroll: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    val theme = LocalTheme.current
    Scaffold(
        containerColor = theme.background,
        topBar = {
            TopAppBar(
                title = { T(title, variant = TextVariant.Heading, color = tint ?: theme.text, maxLines = 1) },
                navigationIcon = {
                    IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = tint ?: theme.primary) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = theme.background),
            )
        },
    ) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier).padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) { content() }
    }
}
