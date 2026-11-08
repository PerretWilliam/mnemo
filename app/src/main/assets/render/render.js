// Runs inside the WebView. Math is pulled out before Markdown parsing so `_` and `*` in LaTeX
// are not turned into emphasis, then rendered with KaTeX and put back.
const src = window.__SOURCE__;
const math = [];
const protectedSrc = src.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m, block, inline) => {
  math.push([block !== undefined ? block : inline, block !== undefined]);
  return '@@MATH' + (math.length - 1) + '@@';
});
let html = marked.parse(protectedSrc, { breaks: true });
html = html.replace(/@@MATH(\d+)@@/g, (m, i) => {
  const [tex, display] = math[Number(i)];
  return katex.renderToString(tex, { displayMode: display, throwOnError: false });
});
const root = document.getElementById('root');
root.innerHTML = html;
// The app reads the height from the console (WebChromeClient.onConsoleMessage): no JS bridge needed.
const post = () => console.log('mnemo-height:' + Math.ceil(root.getBoundingClientRect().height));
new ResizeObserver(post).observe(root);
post();
