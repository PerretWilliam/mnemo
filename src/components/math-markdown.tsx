// Renders Markdown + KaTeX math in a WebView, fully offline (assets are inlined at install time).
// One WebView per displayed card face / preview — never one per list item.
import { useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { KATEX_CSS, KATEX_JS, MARKED_JS } from '@/render/assets.generated';

// Runs inside the WebView. Math is pulled out before Markdown parsing so `_` and `*` in LaTeX
// are not turned into emphasis, then rendered with KaTeX and put back.
const RENDER_JS = `
const src = window.__SOURCE__;
const math = [];
const protectedSrc = src.replace(/\\$\\$([\\s\\S]+?)\\$\\$|\\$([^$\\n]+?)\\$/g, (m, block, inline) => {
  math.push([block !== undefined ? block : inline, block !== undefined]);
  return '@@MATH' + (math.length - 1) + '@@';
});
let html = marked.parse(protectedSrc, { breaks: true });
html = html.replace(/@@MATH(\\d+)@@/g, (m, i) => {
  const [tex, display] = math[Number(i)];
  return katex.renderToString(tex, { displayMode: display, throwOnError: false });
});
const root = document.getElementById('root');
root.innerHTML = html;
const post = () => window.ReactNativeWebView.postMessage(String(Math.ceil(root.getBoundingClientRect().height)));
new ResizeObserver(post).observe(root);
post();
`;

function buildHtml(source: string, theme: Theme, center: boolean, fontSize: number) {
  // A per-render nonce lets our scripts run while blocking inline handlers injected by card content.
  const nonce = Math.random().toString(36).slice(2);
  // `<` is escaped so card content cannot close the <script> tag.
  const json = JSON.stringify(source).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'nonce-${nonce}'">
<style>${KATEX_CSS}</style>
<style>
  html,body{margin:0;padding:0;background:transparent;color:${theme.text};
    font:${fontSize}px/1.5 -apple-system,Roboto,system-ui,sans-serif;-webkit-text-size-adjust:100%}
  #root{padding:2px;overflow-wrap:anywhere;${center ? 'text-align:center;' : ''}}
  #root>:first-child{margin-top:0} #root>:last-child{margin-bottom:0}
  a{color:${theme.primary}} hr{border:0;border-top:1px solid ${theme.border};margin:16px 0}
  code{background:${theme.muted};padding:1px 4px;border-radius:4px}
  pre{background:${theme.muted};padding:8px;border-radius:8px;overflow-x:auto;text-align:left}
  table{border-collapse:collapse;margin:auto} td,th{border:1px solid ${theme.border};padding:4px 8px}
  .katex-display{overflow-x:auto;overflow-y:hidden}
  .cloze{color:${theme.primary};font-weight:600}
  mark.cloze{background:${theme.highlight};color:inherit;border-radius:4px;padding:0 3px}
</style></head><body><div id="root"></div>
<script nonce="${nonce}">window.__SOURCE__=${json};</script>
<script nonce="${nonce}">${MARKED_JS}</script>
<script nonce="${nonce}">${KATEX_JS}</script>
<script nonce="${nonce}">${RENDER_JS}</script>
</body></html>`;
}

type Props = {
  source: string;
  center?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function MathMarkdown({ source, center = false, fontSize = 17, style }: Props) {
  const theme = useTheme();
  const [height, setHeight] = useState(24);
  const html = useMemo(() => buildHtml(source, theme, center, fontSize), [source, theme, center, fontSize]);

  return (
    // pointerEvents="none": touches go to the parent (tap to flip, swipe, scroll).
    <View pointerEvents="none" style={[{ height }, style]}>
      <WebView
        originWhitelist={['about:*']}
        source={{ html, baseUrl: 'about:blank' }}
        onMessage={(e) => setHeight(Math.max(24, Number(e.nativeEvent.data) + 4))}
        onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:')}
        scrollEnabled={false}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
