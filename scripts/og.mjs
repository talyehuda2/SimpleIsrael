// מייצר תמונת שיתוף (OG) 1200x630 לכל פריט ולכל תקופה, על גבי איור הקלף.
// הטקסט מצויר בפונט Frank Ruhl Libre האמיתי — כך העברית תמיד תקינה,
// בניגוד לכיתוב שנוצר על ידי מחולל תמונות.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const FONTS = [
  join(FD, '900Black', 'FrankRuhlLibre_900Black.ttf'),
  join(FD, '700Bold', 'FrankRuhlLibre_700Bold.ttf'),
  join(FD, '500Medium', 'FrankRuhlLibre_500Medium.ttf'),
];
const BASE = readFileSync(join(ROOT, 'build-assets', 'og-base.jpg')).toString('base64');
const QUALITY = 80;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// גודל הגופן מותאם לאורך השם, כדי שלא יגלוש מהכרטיס
const fit = (n) => (n.length <= 12 ? 96 : n.length <= 20 ? 74 : n.length <= 30 ? 58 : 46);
const trim = (n) => (n.length <= 44 ? n : n.slice(0, 43) + '…');

const corner = (x, y, sx, sy) =>
  `<g transform="translate(${x},${y}) scale(${sx},${sy})" fill="none" stroke="#a8842c" stroke-width="2.5">` +
  `<path d="M0,32 L0,9 Q0,0 9,0 L32,0"/><path d="M8,42 L8,19 Q8,8 19,8 L42,8" stroke-width="1.1" opacity="0.7"/>` +
  `<circle cx="5" cy="5" r="2.4" fill="#a8842c" stroke="none"/></g>`;

export function buildSvg({ name, kindLabel, dates }) {
  const n = trim(name);
  const fs = fit(n);
  const nameY = 176 + 34 + fs * 0.76;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" direction="rtl">
<image href="data:image/jpeg;base64,${BASE}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
<rect x="16" y="16" width="1168" height="598" rx="8" fill="none" stroke="#a8842c" stroke-width="3"/>
<rect x="27" y="27" width="1146" height="576" rx="4" fill="none" stroke="#a8842c" stroke-width="1" opacity="0.55"/>
${corner(32, 32, 1, 1)}${corner(1168, 32, -1, 1)}${corner(32, 598, 1, -1)}${corner(1168, 598, -1, -1)}
<text x="1112" y="176" text-anchor="end" font-weight="700" font-size="32" fill="#8a6a24" letter-spacing="1">${esc(kindLabel)}</text>
<text x="1112" y="${nameY}" text-anchor="end" font-weight="900" font-size="${fs}" fill="#16385c">${esc(n)}</text>
<line x1="732" y1="${nameY + 34}" x2="1112" y2="${nameY + 34}" stroke="#a8842c" stroke-width="1.5" opacity="0.75"/>
<text x="1112" y="${nameY + 80}" text-anchor="end" font-weight="500" font-size="30" fill="#6b5426">${esc(dates)}</text>
<text x="1112" y="566" text-anchor="end" font-weight="700" font-size="28" fill="#16385c">ציר הזמן של עם ישראל</text>
<text x="88" y="566" text-anchor="start" font-weight="700" font-size="26" fill="#f7edd6" stroke="#f7edd6" stroke-width="6" stroke-linejoin="round" direction="ltr" opacity="0.85">simpleisrael.co.il</text>
<text x="88" y="566" text-anchor="start" font-weight="700" font-size="26" fill="#16385c" direction="ltr">simpleisrael.co.il</text>
</svg>`;
}

export function renderJpeg(svg) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Frank Ruhl Libre' },
  }).render();
  return jpeg.encode({ data: Buffer.from(r.pixels), width: r.width, height: r.height }, QUALITY).data;
}

// יעד: dist/og/<kind>/<id>.jpg
export function writeCard(outDir, relPath, data) {
  const full = join(outDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, renderJpeg(buildSvg(data)));
}
