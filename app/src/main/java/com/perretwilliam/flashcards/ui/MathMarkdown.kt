// Renders Markdown + KaTeX math in a WebView, fully offline: assets/render is served through
// WebViewAssetLoader. One WebView per displayed card face / preview, never one per list item.
package com.perretwilliam.flashcards.ui

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import java.util.UUID

private const val BASE = "https://appassets.androidplatform.net/assets/render/"

private fun css(c: Color) = "#%06X".format(c.toArgb() and 0xFFFFFF)

private fun buildHtml(source: String, t: Theme, center: Boolean, fontSize: Int): String {
    // A per-render nonce lets our scripts run while blocking inline handlers injected by card content.
    val nonce = UUID.randomUUID().toString().replace("-", "")
    // `<` is escaped so card content cannot close the <script> tag.
    val json = org.json.JSONObject.quote(source).replace("<", "\\u003c")
    return """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' $BASE; font-src $BASE; img-src data:; script-src 'nonce-$nonce'">
<link rel="stylesheet" href="katex.min.css">
<style>
  html,body{margin:0;padding:0;background:transparent;color:${css(t.text)};
    font:${fontSize}px/1.5 Roboto,system-ui,sans-serif;-webkit-text-size-adjust:100%}
  #root{padding:2px;overflow-wrap:anywhere;${if (center) "text-align:center;" else ""}}
  #root>:first-child{margin-top:0} #root>:last-child{margin-bottom:0}
  a{color:${css(t.primary)}} hr{border:0;border-top:1px solid ${css(t.border)};margin:16px 0}
  code{background:${css(t.muted)};padding:1px 4px;border-radius:4px}
  pre{background:${css(t.muted)};padding:8px;border-radius:8px;overflow-x:auto;text-align:left}
  table{border-collapse:collapse;margin:auto} td,th{border:1px solid ${css(t.border)};padding:4px 8px}
  .katex-display{overflow-x:auto;overflow-y:hidden}
  .cloze{color:${css(t.primary)};font-weight:600}
  mark.cloze{background:${css(t.highlight)};color:inherit;border-radius:4px;padding:0 3px}
</style></head><body><div id="root"></div>
<script nonce="$nonce">window.__SOURCE__=$json;</script>
<script nonce="$nonce" src="marked.umd.js"></script>
<script nonce="$nonce" src="katex.min.js"></script>
<script nonce="$nonce" src="render.js"></script>
</body></html>"""
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun MathMarkdown(source: String, modifier: Modifier = Modifier, center: Boolean = false, fontSize: Int = 17) {
    val theme = LocalTheme.current
    // CSS pixels equal dp in a WebView with a device-width viewport, so the reported height is used as is.
    var height by remember { mutableStateOf(24.dp) }
    val html = remember(source, theme, center, fontSize) { buildHtml(source, theme, center, fontSize) }

    Box(modifier.fillMaxWidth().height(maxOf(height, 24.dp))) {
        AndroidView(
            factory = { context ->
                val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context)).build()
                WebView(context).apply {
                    setBackgroundColor(AndroidColor.TRANSPARENT)
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false
                    settings.javaScriptEnabled = true // only our own bundled scripts run (see the CSP)
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                            loader.shouldInterceptRequest(request.url)

                        // No navigation away from the card (links in card content do nothing).
                        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = true
                    }
                    webChromeClient = object : WebChromeClient() {
                        override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                            m.message().removePrefix("mnemo-height:").takeIf { it != m.message() }?.toIntOrNull()?.let {
                                height = (it + 4).dp
                            }
                            return true
                        }
                    }
                }
            },
            update = { view ->
                if (view.tag != html) {
                    view.tag = html
                    view.loadDataWithBaseURL(BASE, html, "text/html", "utf-8", null)
                }
            },
            onRelease = { it.destroy() },
            modifier = Modifier.fillMaxSize(),
        )
        // Transparent layer on top: touches go to Compose (tap to flip, swipe, scroll), never to the page.
        Box(Modifier.matchParentSize().pointerInput(Unit) {})
    }
}
