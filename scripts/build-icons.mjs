// Generates every app icon / splash PNG from the SVG logo below.
// Run manually after changing the logo: `node scripts/build-icons.mjs` (needs `rsvg-convert`,
// e.g. `brew install librsvg`). Outputs are committed in app/src/main/res/drawable-nodpi/.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const tmp = mkdtempSync(join(tmpdir(), 'icons-'));

const BRAND = '#1F2937'; // keep in sync with res/values/colors.xml

const defs = '';

// One white card with an "M", slightly tilted, behind it a faint second card. Drawn around (512, 512).
// `scale` shrinks it for safe zones.
function cards({ scale = 1, mono = false } = {}) {
  const back = mono ? 'fill="none" stroke="#fff" stroke-width="28"' : 'fill="#fff" fill-opacity="0.22"';
  const front = mono ? 'fill="none" stroke="#fff" stroke-width="28"' : 'fill="#fff"';
  const m = mono ? '#fff' : BRAND;
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <rect x="292" y="232" width="400" height="540" rx="56" ${back} transform="rotate(-12 492 502)"/>
    <rect x="332" y="252" width="400" height="540" rx="56" ${front} transform="rotate(6 532 522)"/>
    <path d="M422 642 V442 L532 562 L642 442 V642" fill="none" stroke="${m}" stroke-width="52"
      stroke-linecap="round" stroke-linejoin="round" transform="rotate(6 532 522)"/>
  </g>`;
}

const svg = (body, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${bg}${body}</svg>`;

const files = {
  // Android adaptive icon: the launcher crops to the inner ~66%, so the logo is scaled down.
  'ic_launcher_background.png': svg('', `<rect width="1024" height="1024" fill="${BRAND}"/>`),
  'ic_launcher_foreground.png': svg(cards({ scale: 0.72 })),
  'ic_launcher_monochrome.png': svg(cards({ scale: 0.72, mono: true })),
  // Splash: logo drawn on the solid brand background set in res/values/colors.xml.
  'splash_icon.png': svg(cards({ scale: 1 })),
};

for (const [name, content] of Object.entries(files)) {
  const src = join(tmp, name.replace('.png', '.svg'));
  writeFileSync(src, content);
  execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', '-o', join(out, name), src]);
  console.log(`app/src/main/res/drawable-nodpi/${name}`);
}
