/* דף דמות להורדה: עמוד A4 אחד (PDF) על דמות אחת, מתוך נתוני האתר.

   בעל האתר ביקש (אוקטובר 2026) "דף הסבר על כל דמות שאפשר להוריד": התוכן על
   הדמות, התקופה, הדמויות שחיו בזמנה, הנביאים בימיה, מפת המסע, וזכויות יוצרים.
   הכל נגזר מאותם קבצים שהאתר מציג - שום טקסט לא נכתב כאן מחדש, ולכן תיקון
   בתוכן מתקן גם את הדף.

   שימוש:  node scripts/sheet.mjs united:david [leader:moshe ...]
   הפלט:   sheets-out/<kind>-<id>.pdf (+ .html לבדיקה), sheets-out ב-.gitignore.

   ה-PDF מודפס בדפדפן ולא נבנה בספריית PDF: עברית מימין לשמאל, ניקוד וסימני
   פיסוק יוצאים נכון רק במנוע של דפדפן. המפה היא אותה מפה של תמונות השיתוף
   (heroSvg ב-hero.mjs), נצרבת ל-JPEG כמו שם. בסביבה בלי Chrome:
   SHEET_BROWSER=<נתיב ל-chromium> (או SMOKE_BROWSER). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import { ALL_ITEMS, resolveKey, itemKey } from '../src/data/items.js';
import maps from '../src/data/maps.json' with { type: 'json' };
import periods from '../src/data/periods.json' with { type: 'json' };
import { journeyStations, MAP_SIZE, offMapPin } from '../src/utils/mapProject.js';
import { stationNoteText } from '../src/utils/placeNote.js';
import { periodOfItem, relatedByEra } from '../src/utils/related.js';
import { formatRangeAM, formatRangeSecular } from '../src/utils/dates.js';
import { windowFor } from './hero.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'sheets-out');
const SITE = 'https://simpleisrael.co.il';
const SITE_NAME = 'ציר הזמן של עם ישראל';

const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך - הממלכה המאוחדת', judah: 'מלך יהודה',
  israel: 'מלך ישראל', prophet: 'נביא', book: 'ספר', event: 'אירוע', world: 'רקע עולמי', empire: 'מלכות עולמית',
};
const KIND_COLOR = {
  leader: '#9c2b50', judge: '#bd7038', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c', world: '#5a6470', empire: '#5a6470',
};
const PERSONS = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'world']);
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// אותה חפיפה של "חי במקביל" בכרטיס (App.jsx): פריט של שנה אחת נכלל אם נפל בטווח
const overlap = (a, b) => {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
};

/* המפה: אותו חיתוך של תמונות השיתוף (windowFor ב-hero.mjs), אבל בתחנות רק
   מספרים - השמות ברשימה שליד המפה. שמות על המפה עצמה עלו זה על זה בדף בגודל
   הזה, ו-resvg (בלי bidi מלא) הפך חלק מהם. מקום מחוץ למסגרת עובר לשולי החיתוך
   עם חוד החוצה (offMapPin), כמו בשאר האתר. */
let MAP64 = null;
const mapData = () => (MAP64 ||= readFileSync(join(ROOT, 'public', 'israel_map_square2.png')).toString('base64'));
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const FONTS = ['900Black/FrankRuhlLibre_900Black.ttf', '700Bold/FrankRuhlLibre_700Bold.ttf'].map((f) => join(FD, f));
function mapJpeg(allPts, color, size = 760) {
  const box = windowFor(allPts, 1);
  const k = box.w / size, r = 22 * k, pad = r * 2.2;
  const clampTo = (v, lo, hi) => Math.max(lo + pad, Math.min(hi - pad, v));
  const pts = allPts.map((p) => (p.off
    ? { ...p, x: clampTo(p.x, box.x, box.x + box.w), y: clampTo(p.y, box.y, box.y + box.h) } : p));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dot = (p) => (p.off
    ? `<path d="${offMapPin(p.x, p.y, p.off, r, r * 0.3, r * 0.6)}" stroke-linejoin="round"`
    : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.w.toFixed(1)} ${box.h.toFixed(1)}">
<image href="data:image/png;base64,${mapData()}" x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" preserveAspectRatio="none"/>
<path d="${path}" fill="none" stroke="#163a57" stroke-width="${(3.2 * k).toFixed(2)}" stroke-dasharray="${(9 * k).toFixed(1)} ${(7 * k).toFixed(1)}" stroke-linecap="round" opacity=".8"/>
${pts.map((p, i) => `${dot(p)} fill="${color}" stroke="#fdf6e6" stroke-width="${(3 * k).toFixed(2)}"/>
<text x="${p.x.toFixed(1)}" y="${(p.y + r * 0.38).toFixed(1)}" text-anchor="middle" font-family="Frank Ruhl Libre" font-weight="900" font-size="${(r * 1.05).toFixed(1)}" fill="#fff">${i + 1}</text>`).join('\n')}
</svg>`;
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Frank Ruhl Libre' },
  }).render();
  return jpeg.encode({ data: Buffer.from(png.pixels), width: png.width, height: png.height }, 84).data.toString('base64');
}

const font = (f) => `data:font/woff2;base64,${readFileSync(join(ROOT, 'public', 'fonts', f)).toString('base64')}`;

function chips(list) {
  return list.map((x) => `<span class="chip"><i style="background:${KIND_COLOR[x.kind] || '#777'}"></i>${esc(x.name)}`
    + `<small>${esc(formatRangeAM(x.start, x.end).replace(/ \(.*\)$/, ''))}</small></span>`).join('');
}

function sheetHtml(item) {
  const key = itemKey(item);
  const color = KIND_COLOR[item.kind] || '#9c2b50';
  const era = periodOfItem(item, periods);
  const others = ALL_ITEMS.filter((x) => itemKey(x) !== key && overlap(item, x));
  /* "דמויות מתקופתו": לא רק מי שחי בדיוק באותן שנים - לדוד אין כאלה בנתונים
     (שאול מסיים כשהוא מתחיל, ושלמה מתחיל כשהוא מת). אותו חישוב של "אולי יעניין
     אותך גם" באתר: אותה תקופה, הקרובים בזמן ראשונים, ואז לפי סדר השנים */
  const people = relatedByEra(item, ALL_ITEMS.filter((x) => PERSONS.has(x.kind)), periods, new Set(), 12)
    .sort((a, b) => a.start - b.start);
  const books = others.filter((x) => x.kind === 'book' && x.end - x.start < 400);
  const prophets = others.filter((x) => x.kind === 'prophet').sort((a, b) => a.start - b.start);
  const events = others.filter((x) => x.kind === 'event').sort((a, b) => a.start - b.start);
  const pts = maps[item.id] ? journeyStations(maps[item.id]) : [];
  const dur = item.reignText || item.lifeText || item.tenureText || '';
  const url = `${SITE}/p/${item.kind}/${item.id}`;

  const mapBlock = pts.length >= 2 ? `
  <section class="map">
    <h2>מפת המסע${maps[item.id].title ? ` · ${esc(maps[item.id].title)}` : ''}</h2>
    <div class="map-row">
      <img src="data:image/jpeg;base64,${mapJpeg(pts, color)}" alt="">
      <ol>${pts.map((p) => `<li><b>${esc(p.name)}</b>${p.label ? ` - ${esc(p.label)}` : ''}${p.ref || stationNoteText(p.name) ? `<small>${esc(p.ref || '')}${stationNoteText(p.name) ? `${p.ref ? ' · ' : ''}<span class="nt">${esc(stationNoteText(p.name).replace(/^[ ·(]+|\)$/g, ''))}</span>` : ''}</small>` : ''}</li>`).join('')}</ol>
    </div>
  </section>` : '';

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${esc(item.name)} - ${SITE_NAME}</title>
<style>
@font-face{font-family:'Frank Ruhl Libre';font-weight:500 900;src:url(${font('frankruhllibre-hebrew.woff2')}) format('woff2')}
@font-face{font-family:'Heebo';font-weight:300 700;src:url(${font('heebo-hebrew.woff2')}) format('woff2')}
@font-face{font-family:'Heebo';font-weight:300 700;src:url(${font('heebo-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0}
/* .content מוגדל ב-zoom עד שהוא ממלא את העמוד (ראו fill למטה); הרוחב מחולק
   באותו מקדם, כדי שאחרי ההגדלה הוא יחזור בדיוק לרוחב העמוד */
.content{width:calc(184mm / var(--z,1));zoom:var(--z,1)}
body{font-family:Heebo,sans-serif;color:#2b2416;background:#fbf5e7;font-size:10.4pt;line-height:1.5;
  width:210mm;min-height:297mm;padding:11mm 13mm 9mm;display:flex;flex-direction:column;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b28a2b;padding-bottom:5px}
.brand{font-family:'Frank Ruhl Libre',serif;font-weight:900;font-size:12.5pt;color:#163a57}
.kind{font-size:9pt;font-weight:700;color:#fff;background:${color};padding:2px 10px;border-radius:999px}
h1{font-family:'Frank Ruhl Libre',serif;font-weight:900;font-size:30pt;line-height:1.1;margin:10px 0 2px;color:#163a57}
.years{font-weight:700;color:#5b4a2a;font-size:10.5pt}
.years span{color:#8a7650;font-weight:500}
.facts{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0 8px;font-size:9.5pt;color:#4a3d25}
.facts b{color:#163a57}
.verse{border-inline-start:4px solid #b28a2b;background:#f3e8cc;padding:6px 12px;margin:6px 0 10px;
  border-start-end-radius:8px;border-end-end-radius:8px;font-family:'Frank Ruhl Libre',serif;font-size:12.5pt;font-weight:700;color:#3d2f12}
.verse small{display:block;font-family:Heebo,sans-serif;font-size:8.5pt;font-weight:500;color:#7a5b16}
.desc{text-align:justify;margin:0 0 10px}
h2{font-family:'Frank Ruhl Libre',serif;font-weight:900;font-size:13pt;color:#163a57;margin:10px 0 5px;
  border-bottom:1px solid #e2d3b0;padding-bottom:2px}
.map-row{display:grid;grid-template-columns:104mm 1fr;gap:10px;align-items:start}
.map img{width:104mm;height:104mm;border-radius:6px;border:1px solid #d9c79c;display:block}
.map ol{margin:0;padding-inline-start:20px;font-size:9pt;line-height:1.35}
.map li{margin-bottom:3px}
.map li small{display:block;color:#8a7650;font-size:8pt}
.map li .nt{color:#9c2b50}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{display:inline-flex;align-items:center;gap:5px;background:#fff8e8;border:1px solid #e2d3b0;border-radius:999px;
  padding:1px 9px;font-size:9pt;font-weight:700;white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;display:inline-block}
.chip small{font-weight:500;color:#8a7650;font-size:8pt}
.events{margin:0;padding-inline-start:18px;font-size:9pt}
.src{font-size:8.5pt;color:#6b5a3e;margin-top:8px}
.foot{margin-top:auto;padding-top:6px;border-top:1px solid #d9c79c;display:flex;justify-content:space-between;
  font-size:8pt;color:#6b5a3e}
.foot b{color:#163a57}
.note{font-size:7.5pt;color:#8a7650}
</style></head><body>
<main class="content">
<div class="top"><div class="brand">${SITE_NAME}</div><div class="kind">${esc(KIND_LABELS[item.kind] || '')}</div></div>
<h1>${esc(item.name)}</h1>
<div class="years">${esc(formatRangeAM(item.start, item.end))} לבריאה <span>· ${esc(formatRangeSecular(item.start, item.end))}</span></div>
<div class="facts">
  ${era ? `<div>תקופה: <b>${esc(era.name)}</b> (${esc(formatRangeAM(era.start, era.end).replace(/ \(.*\)$/, ''))})</div>` : ''}
  ${dur ? `<div>${item.reignText ? 'מלך' : 'משך'}: <b>${esc(dur)}</b></div>` : ''}
  ${item.kings ? `<div>בימי: <b>${esc(item.kings)}</b></div>` : ''}
</div>
${item.verse ? `<div class="verse">"${esc(item.verse)}"${item.verseRef ? `<small>${esc(item.verseRef)}</small>` : ''}</div>` : ''}
<p class="desc">${esc(item.description || '')}</p>
${mapBlock}
<div class="cols">
  <section><h2>דמויות מתקופתו</h2><div class="chips">${chips(people.slice(0, 16)) || '<span class="note">-</span>'}</div></section>
  <section>${prophets.length ? `<h2>נביאים בימיו</h2><div class="chips">${chips(prophets)}</div>` : ''}
  ${events.length ? `<h2>אירועים בימיו</h2><ul class="events">${events.slice(0, 6).map((e) => `<li><b>${esc(e.name)}</b> <span class="note">${esc(formatRangeAM(e.start, e.end).replace(/ \(.*\)$/, ''))}</span></li>`).join('')}</ul>` : ''}
  </section>
</div>
${item.source || books.length ? `<div class="src">${item.source ? `מקור: ${esc(item.source)}` : ''}${books.length ? `${item.source ? ' · ' : ''}ספרי התנ"ך של התקופה: ${books.map((b) => esc(b.name)).join(', ')}` : ''}</div>` : ''}
</main>
<div class="foot">
  <div>© כל הזכויות שמורות ל<b>${SITE_NAME}</b> · השנים לבריאה לפי סדר עולם</div>
  <div dir="ltr">${esc(url.replace('https://', ''))}</div>
</div>
</body></html>`;
}

async function launch() {
  const exe = process.env.SHEET_BROWSER || process.env.SMOKE_BROWSER;
  if (exe) return chromium.launch({ executablePath: exe });
  for (const channel of ['chrome', 'msedge', null]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch { /* הבא */ }
  }
  console.error('לא נמצא דפדפן. להתקין Chrome, או להגדיר SHEET_BROWSER לנתיב של chromium.');
  process.exit(1);
}

const keys = process.argv.slice(2);
if (!keys.length) { console.error('שימוש: node scripts/sheet.mjs <kind:id> ...  (למשל united:david)'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const key of keys) {
  const item = resolveKey(key);
  if (!item) { console.error(`אין פריט ${key}`); continue; }
  const html = sheetHtml(item);
  const base = join(OUT, `${item.kind}-${item.id}`);
  writeFileSync(`${base}.html`, html);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // דף אחד: אם התוכן ארוך מ-A4, מקטינים מעט את הכל במקום לשבור לשני דפים
  /* הדף ממלא עמוד A4 שלם: התוכן מוגדל (zoom) עד שהוא מגיע לתחתית, בלי לגלוש
     לעמוד שני. דמות עם תיאור קצר הייתה משאירה רבע עמוד ריק. חיפוש בינארי
     על המקדם, עד פי 1.3 */
  const pageH = 297 * 96 / 25.4;
  const z = await page.evaluate((pageH) => {
    // הגוף הוא תמיד לפחות עמוד שלם (min-height), ולכן מודדים את התוכן עצמו:
    // תחתית התוכן + הכותרת התחתונה + השוליים, עם מרווח ביטחון להדפסה
    const mm = 96 / 25.4, foot = document.querySelector('.foot'), content = document.querySelector('.content');
    const fits = (k) => {
      document.documentElement.style.setProperty('--z', k);
      return content.getBoundingClientRect().bottom + foot.offsetHeight + 8 + 9 * mm <= pageH - 10;
    };
    if (!fits(1)) { fits(1); return 1; }
    let lo = 1, hi = 1.3;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    fits(lo); return lo;
  }, pageH);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const scale = h > pageH + 1 ? Math.max(0.75, pageH / h) : 1;
  await page.pdf({ path: `${base}.pdf`, format: 'A4', printBackground: true, scale, preferCSSPageSize: true });
  await page.close();
  console.log(`${base}.pdf  (A4, ${scale < 0.995 ? `הוקטן ל-${Math.round(scale * 100)}%` : `הוגדל פי ${z.toFixed(2)}`})`);
}
await browser.close();
