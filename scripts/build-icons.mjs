// Generates every app icon / splash PNG from the SVG logo below.
// Run manually after changing the logo: `node scripts/build-icons.mjs` (needs `rsvg-convert`,
// e.g. `brew install librsvg`). Outputs are committed in assets/images/.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');
const tmp = mkdtempSync(join(tmpdir(), 'icons-'));

const BRAND_FROM = '#4F46E5';
const BRAND_TO = '#9333EA';
const SPARK = '#F59E0B';

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${BRAND_FROM}"/><stop offset="1" stop-color="${BRAND_TO}"/>
  </linearGradient>
</defs>`;

// Two stacked cards with an "M" stroke, drawn around (512, 512). `scale` shrinks it for safe zones.
function cards({ scale = 1, mono = false } = {}) {
  const back = mono ? 'fill="none" stroke="#fff" stroke-width="28"' : 'fill="#fff" fill-opacity="0.32"';
  const front = mono ? 'fill="none" stroke="#fff" stroke-width="28"' : 'fill="#fff"';
  const m = mono ? '#fff' : 'url(#bg)';
  return `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <rect x="292" y="232" width="400" height="540" rx="56" ${back} transform="rotate(-14 492 502)"/>
    <rect x="332" y="252" width="400" height="540" rx="56" ${front} transform="rotate(7 532 522)"/>
    <path d="M422 642 V442 L532 562 L642 442 V642" fill="none" stroke="${m}" stroke-width="58"
      stroke-linecap="round" stroke-linejoin="round" transform="rotate(7 532 522)"/>
    ${mono ? '' : `<path d="M720 214 l22 48 48 22 -48 22 -22 48 -22 -48 -48 -22 48 -22z" fill="${SPARK}"/>`}
  </g>`;
}

const svg = (body, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}${bg}${body}</svg>`;

const files = {
  // Legacy / store icon: full-bleed gradient square.
  'icon.png': svg(cards({ scale: 0.92 }), '<rect width="1024" height="1024" fill="url(#bg)"/>'),
  // Android adaptive icon: the launcher crops to the inner ~66%, so the logo is scaled down.
  'android-icon-background.png': svg('', '<rect width="1024" height="1024" fill="url(#bg)"/>'),
  'android-icon-foreground.png': svg(cards({ scale: 0.72 })),
  'android-icon-monochrome.png': svg(cards({ scale: 0.72, mono: true })),
  // Splash: logo drawn on the solid brand background set in app.config.ts.
  'splash-icon.png': svg(cards({ scale: 1 })),
};

for (const [name, content] of Object.entries(files)) {
  const src = join(tmp, name.replace('.png', '.svg'));
  writeFileSync(src, content);
  execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', '-o', join(out, name), src]);
  console.log(`assets/images/${name}`);
}
