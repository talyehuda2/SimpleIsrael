/* תמונת-פתיח לדף-נחיתה: קטע מהמפה שבו עוברות תחנות המסע, עם המסלול
   והתחנות מצוירים עליו. הקובץ המקורי של המפה שוקל 2.7MB ואי אפשר
   לשים אותו בראש דף שנטען מגוגל, ולכן החיתוך נצרב פעם אחת בבנייה
   לקובץ JPEG קטן - אותו היטל בדיוק שמשמש את שני המסכים החיים. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { MAP_SIZE } from '../src/utils/mapProject.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const FONTS = [
  join(FD, '900Black', 'FrankRuhlLibre_900Black.ttf'),
  join(FD, '700Bold', 'FrankRuhlLibre_700Bold.ttf'),
  join(FD, '500Medium', 'FrankRuhlLibre_500Medium.ttf'),
];
// נקרא פעם אחת: אותה מפה משרתת את כל התמונות
let MAP64 = null;
const mapData = () => (MAP64 ||= readFileSync(join(ROOT, 'public', 'israel_map_square2.png')).toString('base64'));

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* חלון הצפייה: תיבת התחנות, מרווחת, מורחבת ליחס הצדדים המבוקש
   ומוזזת פנימה אם חרגה מגבולות הציור.

   התיבה נמדדת על עיקר התחנות ולא על הקצוות: למסע אחד (אליהו) יש תחנה
   בהר חורב ותחנה בצידון, ותיבה שמכילה את שתיהן היא כל המפה - ריבוע
   שדוחף את כפתורי הבחירה אל מתחת לקפל. התמונה היא הזמנה ולא נתון:
   המסלול פשוט ממשיך אל מחוץ לפריים, כמו במפה אמיתית. */
const quantile = (arr, t) => {
  const s = [...arr].sort((a, b) => a - b);
  const i = (s.length - 1) * t;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
function windowFor(pts, ar) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const bx = quantile(xs, 0.12), by = quantile(ys, 0.12);
  let w = (quantile(xs, 0.88) - bx) * 1.44 + 140;
  let h = (quantile(ys, 0.88) - by) * 1.44 + 140;
  /* התאמה ליחס הצדדים: הרחבה מלאה מציגה את כל התחנות אבל ממלאת את
     הפריים בים, וכיווץ מלא מקרב עד שלא נשאר סיפור. הממוצע הגאומטרי
     בין השניים נותן מפה שרואים בה פרטים ורוב התחנות. */
  const fit = (a, b) => Math.sqrt(Math.min(a, MAP_SIZE) * b);
  if (w / h < ar) { w = fit(h * ar, w); h = w / ar; }
  else { h = fit(w / ar, h); w = h * ar; }
  if (w > MAP_SIZE) { const k = MAP_SIZE / w; w = MAP_SIZE; h *= k; }
  if (h > MAP_SIZE) { const k = MAP_SIZE / h; h = MAP_SIZE; w *= k; }
  // ממורכז על חציון התחנות, ומוחזר פנימה אם חרג מגבולות הציור
  const x = Math.max(0, Math.min(MAP_SIZE - w, quantile(xs, 0.5) - w / 2));
  const y = Math.max(0, Math.min(MAP_SIZE - h, quantile(ys, 0.5) - h / 2));
  return { x, y, w, h };
}

export function heroSvg(pts, { w = 1080, h = 608 } = {}) {
  const box = windowFor(pts, w / h);
  const k = box.w / w;                       // יחידות מפה לפיקסל תצוגה
  const r = 9 * k, lw = 3.4 * k, fs = 20 * k;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // תווית לצד הנקודה, ולכיוון פנימה כשהיא קרובה לשפה
  const label = (p, i) => {
    const right = p.x > box.x + box.w * 0.62;
    const anchor = right ? 'end' : 'start';
    const tx = p.x + (right ? -r * 1.7 : r * 1.7);
    const ty = p.y + fs * 0.34;
    const t = `${i + 1}. ${p.name}`;
    return `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-size="${fs.toFixed(1)}" font-weight="700" `
      + `fill="#fdf6e6" stroke="#fdf6e6" stroke-width="${(fs * 0.34).toFixed(1)}" stroke-linejoin="round" direction="rtl">${esc(t)}</text>`
      + `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-size="${fs.toFixed(1)}" font-weight="700" fill="#16385c" direction="rtl">${esc(t)}</text>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}">
<image href="data:image/png;base64,${mapData()}" x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" preserveAspectRatio="none"/>
<path d="${path}" fill="none" stroke="#fdf6e6" stroke-width="${(lw * 2.1).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
<path d="${path}" fill="none" stroke="#16385c" stroke-width="${lw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${(lw * 2.4).toFixed(1)} ${(lw * 2.4).toFixed(1)}"/>
${pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="#b28a2b" stroke="#fdf6e6" stroke-width="${(lw * 0.9).toFixed(2)}"/>`).join('\n')}
${pts.map((p, i) => (
    // תווית נכתבת רק לתחנה שיושבת בנוחות בתוך הפריים; תחנה על השפה
    // הייתה נחתכת באמצע המילה
    p.x > box.x + fs && p.x < box.x + box.w - fs
      && p.y > box.y + fs && p.y < box.y + box.h - fs ? label(p, i) : '')).join('\n')}
</svg>`;
}

export function writeHero(outDir, relPath, pts, size) {
  const svg = heroSvg(pts, size);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: (size && size.w) || 1080 },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Frank Ruhl Libre' },
  }).render();
  const full = join(outDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, jpeg.encode({ data: Buffer.from(png.pixels), width: png.width, height: png.height }, 74).data);
  return relPath;
}
