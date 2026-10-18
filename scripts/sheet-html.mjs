/* דף דמות להורדה: עמוד A4 אחד על דמות אחת, מתוך נתוני האתר.

   בעל האתר ביקש (אוקטובר 2026) "דף הסבר על כל דמות שאפשר להוריד": התוכן על
   הדמות, התקופה, הדמויות מתקופתה, הנביאים בימיה, מפת המסע, וזכויות יוצרים.
   הכל נגזר מאותם קבצים שהאתר מציג - שום טקסט לא נכתב כאן מחדש, ולכן תיקון
   בתוכן מתקן גם את הדף.

   המודול הזה מייצר את ה-HTML, ושני צרכנים משתמשים בו:
   - prerender.mjs: עמוד באתר, /p/<kind>/<id>/sheet, עם כפתור "הורדה / הדפסה"
     (window.print - "שמירה כ-PDF" בכל דפדפן). נבנה בכל פריסה, ולכן תמיד מעודכן;
     PDF מוכן מראש היה מתיישן בשקט עם כל תיקון תוכן, ול-Vercel אין דפדפן בבנייה.
   - sheet.mjs: PDF מקומי בדפדפן ללא ממשק, לבדיקה ולשליחה.
   ההתאמה לעמוד (zoom) רצה בדף עצמו, ולכן שניהם יוצאים זהים. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import jpeg from 'jpeg-js';
import qrcode from 'qrcode-generator';
import { ALL_ITEMS, itemKey } from '../src/data/items.js';
import maps from '../src/data/maps.json' with { type: 'json' };
import periods from '../src/data/periods.json' with { type: 'json' };
import academic from '../src/data/academic.json' with { type: 'json' };
import { journeyStations, MAP_SIZE, offMapPin } from '../src/utils/mapProject.js';
import { stationNoteText } from '../src/utils/placeNote.js';
import { periodOfItem, relatedByEra } from '../src/utils/related.js';
import { formatRangeAM, formatRangeSecular } from '../src/utils/dates.js';
import { windowFor } from './hero.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE = 'https://simpleisrael.co.il';
const SITE_NAME = 'ציר הזמן של עם ישראל';

const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך - הממלכה המאוחדת', judah: 'מלך יהודה',
  israel: 'מלך ישראל', prophet: 'נביא', book: 'ספר', event: 'אירוע', world: 'רקע עולמי', empire: 'מלכות עולמית',
};
// הגוונים הכהים של prerender.mjs: התגית בראש הדף היא טקסט לבן על הצבע
const KIND_COLOR = {
  leader: '#9c2b50', judge: '#97531f', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#8f5f13', book: '#157a70', event: '#b0392c', world: '#5a6470', empire: '#5a6470',
};
const PERSONS = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'world']);
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* "לפי המחקר" - אותו חישוב של researchRange ב-src/utils/research.js (שם ייבוא
   JSON בלי with, שלא נטען ב-Node). כמו בכרטיס: לצד סדר עולם ולא במקומו. */
const RES = {};
for (const [section, map] of Object.entries(academic)) {
  if (section === '_note') continue;
  for (const [id, v] of Object.entries(map)) RES[id] = Array.isArray(v) ? v : [v, v];
}
const resFmt = (y) => (y > 0 ? `${y} לפנה"ס` : `${-y} לספירה`);
function researchRange(id) {
  const r = RES[id]; if (!r) return null;
  return r[0] === r[1] ? resFmt(r[0]) : `${resFmt(r[0])} עד ${resFmt(r[1])}`;
}
// מקוצר, לתגיות ולרשימת האירועים: "1010-970 לפנה"ס"
function researchShort(id) {
  const r = RES[id]; if (!r) return null;
  if (r[0] === r[1]) return resFmt(r[0]);
  if (r[0] > 0 && r[1] > 0) return `${r[0]}-${r[1]} לפנה"ס`;
  return researchRange(id);
}

/* ערכות גופנים. בעל האתר בחר במודרנית (רוביק ואסיסטנט, אוקטובר 2026) - היא
   שבאתר, וקובציה ב-public/fonts. השתיים האחרות לבדיקה מקומית בלבד
   (SHEET_FONT ב-sheet.mjs); הנוספים שבהן ב-build-assets/fonts. כולם OFL. */
export const FONT_SETS = {
  modern: { head: 'Rubik', body: 'Assistant', bodyGeneric: 'sans-serif' },
  classic: { head: 'Frank Ruhl Libre', body: 'Heebo', bodyGeneric: 'sans-serif' },
  book: { head: 'David Libre', body: 'Noto Serif Hebrew', bodyGeneric: 'serif' },
};
const LATIN = 'unicode-range:U+0000-00FF';
const FACES = {
  Rubik: [['400 800', 'rubik-hebrew-400-800.woff2'], ['400 800', 'rubik-latin-400-800.woff2', LATIN]],
  Assistant: [['300 800', 'assistant-hebrew-300-800.woff2'], ['300 800', 'assistant-latin-300-800.woff2', LATIN]],
  'Frank Ruhl Libre': [['500 900', 'frankruhllibre-hebrew.woff2']],
  Heebo: [['300 700', 'heebo-hebrew.woff2'], ['300 700', 'heebo-latin.woff2', LATIN]],
  'David Libre': [['400', 'davidlibre-hebrew-400.woff2'], ['400', 'davidlibre-latin-400.woff2', LATIN],
    ['700', 'davidlibre-hebrew-700.woff2'], ['700', 'davidlibre-latin-700.woff2', LATIN]],
  'Noto Serif Hebrew': [['400 900', 'notoserifhebrew-hebrew-400-900.woff2'], ['400 900', 'notoserifhebrew-latin-400-900.woff2', LATIN]],
};
// גופן כ-data: לדף מקומי (setContent, בלי שרת) - מ-public/fonts או מ-build-assets/fonts
export function inlineFont(file) {
  let buf;
  try { buf = readFileSync(join(ROOT, 'public', 'fonts', file)); } catch { buf = readFileSync(join(ROOT, 'build-assets', 'fonts', file)); }
  return `data:font/woff2;base64,${buf.toString('base64')}`;
}
const faceCss = (family, src) => FACES[family].map(([w, f, extra]) =>
  `@font-face{font-family:'${family}';font-weight:${w};font-display:block;src:url(${src(f)}) format('woff2')${extra ? `;${extra}` : ''}}`).join('\n');

// אותה חפיפה של "חי במקביל" בכרטיס (App.jsx): פריט של שנה אחת נכלל אם נפל בטווח
const overlap = (a, b) => {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
};

export const sheetStations = (item) => (maps[item.id] ? journeyStations(maps[item.id]) : []);

/* המפה: אותו חיתוך של תמונות השיתוף (windowFor ב-hero.mjs), אבל בתחנות רק
   מספרים - השמות ברשימה שליד המפה. שמות על המפה עצמה עלו זה על זה בדף בגודל
   הזה, ו-resvg (בלי bidi מלא) הפך חלק מהם. מקום מחוץ למסגרת עובר לשולי החיתוך
   עם חוד החוצה (offMapPin), כמו בשאר האתר. מחזיר JPEG (Buffer). */
let MAP64 = null;
const mapData = () => (MAP64 ||= readFileSync(join(ROOT, 'public', 'israel_map_square2.png')).toString('base64'));
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const MAP_FONTS = ['900Black/FrankRuhlLibre_900Black.ttf'].map((f) => join(FD, f));
export function mapJpeg(item, size = 760) {
  const allPts = sheetStations(item);
  const color = KIND_COLOR[item.kind] || '#9c2b50';
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
    font: { fontFiles: MAP_FONTS, loadSystemFonts: false, defaultFontFamily: 'Frank Ruhl Libre' },
  }).render();
  return Buffer.from(jpeg.encode({ data: Buffer.from(png.pixels), width: png.width, height: png.height }, 84).data);
}

/* קוד QR לכרטיס באתר החי (לא לעמוד השער - שם אין מדידה), עם src=sheet כדי
   לספור כמה הגיעו מדף מודפס. רמת תיקון M: עמידה בהדפסה ביתית מטושטשת. */
function qrSvg(url) {
  const q = qrcode(0, 'M');
  q.addData(url); q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x},${y}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" role="img" aria-label="קוד QR לכרטיס באתר"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#163a57"/></svg>`;
}

function chips(list) {
  return list.map((x) => `<span class="chip"><i style="background:${KIND_COLOR[x.kind] || '#777'}"></i>${esc(x.name)}`
    + `<small>${esc(formatRangeAM(x.start, x.end).replace(/ \(.*\)$/, ''))}`
    + `${researchShort(x.id) ? ` · <em>${esc(researchShort(x.id))}</em>` : ''}</small></span>`).join('');
}

/* ההתאמה לעמוד: התוכן מוגדל או מוקטן (zoom) עד שהוא ממלא את A4 בדיוק. דמות עם
   תיאור קצר השאירה רבע עמוד ריק, וחזקיהו (הרבה בני תקופה) גלש לעמוד שני. חיפוש
   בינארי על המקדם, בין 0.7 ל-1.3 (בגרסת שני העמודים עד 1.45 - יש בה יותר מקום). רץ בדף עצמו אחרי טעינת הגופנים, ולכן זהה
   בהדפסה מהאתר וב-PDF המקומי. אחר כך, במסך בלבד, הדף כולו מוקטן לרוחב החלון
   (--fit) - בטלפון עמוד A4 רחב מהמסך. */
const FIT_JS = `(function(){
var mm=96/25.4,pageH=297*mm,r=document.documentElement;
function fitPage(pg){var c=pg.querySelector('.content'),f=pg.querySelector('.foot');
function fits(k){pg.style.setProperty('--z',k);var top=pg.getBoundingClientRect().top;return c.getBoundingClientRect().bottom-top+f.offsetHeight+8+9*mm<=pageH-10;}
var lo=0.7,hi=+(pg.dataset.max||1.3);for(var i=0;i<12;i++){var m=(lo+hi)/2;if(fits(m))lo=m;else hi=m;}fits(lo);return lo;}
function screenFit(){var w=Math.min(1,(document.documentElement.clientWidth-16)/(210*mm));r.style.setProperty('--fit',w);}
// כל עמוד מותאם בנפרד (בגרסת שני העמודים לכל אחד מקדם משלו); data-fit = הקטן שבהם
function run(){r.style.setProperty('--fit',1);var z=[].map.call(document.querySelectorAll('.page'),fitPage);r.dataset.fit=Math.min.apply(null,z).toFixed(3);screenFit();}
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){return Promise.all([].map.call(document.images,function(im){return im.complete?0:new Promise(function(ok){im.addEventListener('load',ok);im.addEventListener('error',ok);});}));}).then(run);
addEventListener('resize',screenFit);
var b=document.getElementById('print');if(b)b.addEventListener('click',function(){window.print();});
var d=document.getElementById('dl'),n=document.getElementById('dlnote');if(d&&n)d.addEventListener('click',function(){n.textContent='מכין את הקובץ… ההורדה תתחיל מעצמה';setTimeout(function(){n.textContent='ההורדה מכינה קובץ PDF - לוקח כמה שניות';},12000);});
})();`;

/* opts:
   fontSrc(file) - כתובת לקובץ גופן (באתר '/fonts/..'; מקומית inlineFont)
   mapSrc        - כתובת לתמונת המפה, או null כשאין מסע
   fontSet       - 'modern' (ברירת המחדל) | 'classic' | 'book'
   web           - עמוד באתר: סרגל עם כפתור הורדה וחזרה לכרטיס, noindex
   layouts       - באתר: {one, two} - כתובות שתי הגרסאות למתג בסרגל; בלי two אין מתג
   pages         - 1 (ברירת המחדל) או 2: בעמוד הראשון הדמות ובני תקופתה, בשני
                   המסע - מפה גדולה ורשימת תחנות מלאה. דמות בלי מסע - עמוד אחד. */
export function sheetHtml(item, { fontSrc, mapSrc = null, fontSet = 'modern', web = false, pages = 1, layouts = null } = {}) {
  const key = itemKey(item);
  const color = KIND_COLOR[item.kind] || '#9c2b50';
  const era = periodOfItem(item, periods);
  const others = ALL_ITEMS.filter((x) => itemKey(x) !== key && overlap(item, x));
  /* "דמויות מתקופתו": לא רק מי שחי בדיוק באותן שנים - לדוד אין כאלה בנתונים
     (שאול מסיים כשהוא מתחיל, ושלמה מתחיל כשהוא מת). אותו חישוב של "אולי יעניין
     אותך גם" באתר: אותה תקופה, הקרובים בזמן ראשונים, ואז לפי סדר השנים */
  const two = pages === 2 && !!mapSrc && sheetStations(item).length >= 2;
  // בשני עמודים יש מקום ליותר: עד 20 בני תקופה ו-12 אירועים, במקום 16 ו-6
  const nPeople = two ? 20 : 16, nEvents = two ? 12 : 6;
  const people = relatedByEra(item, ALL_ITEMS.filter((x) => PERSONS.has(x.kind)), periods, new Set(), nPeople)
    .sort((a, b) => a.start - b.start);
  const books = others.filter((x) => x.kind === 'book' && x.end - x.start < 400);
  const prophets = others.filter((x) => x.kind === 'prophet').sort((a, b) => a.start - b.start);
  const events = others.filter((x) => x.kind === 'event').sort((a, b) => a.start - b.start);
  const pts = sheetStations(item);
  const dur = item.reignText || item.lifeText || item.tenureText || '';
  const gate = `${SITE}/p/${item.kind}/${item.id}`;
  const live = `${SITE}/?sel=${key}&src=sheet`;
  const research = researchRange(item.id);
  const fs = FONT_SETS[fontSet];
  const hasRes = [item, ...people.slice(0, nPeople), ...prophets, ...events.slice(0, nEvents)].some((x) => RES[x.id]);
  const stationsOl = () => `<ol>${pts.map((p) => `<li><b>${esc(p.name)}</b>${p.label ? ` - ${esc(p.label)}` : ''}${p.ref || stationNoteText(p.name) ? `<small>${esc(p.ref || '')}${stationNoteText(p.name) ? `${p.ref ? ' · ' : ''}<span class="nt">${esc(stationNoteText(p.name).replace(/^[ ·(]+|\)$/g, ''))}</span>` : ''}</small>` : ''}</li>`).join('')}</ol>`;
  const mapTitle = () => `מפת המסע${maps[item.id].title ? ` · ${esc(maps[item.id].title)}` : ''}`;

  const mapBlock = pts.length >= 2 && mapSrc ? `
  <section class="map">
    <h2>${mapTitle()}</h2>
    <div class="map-row">
      <img src="${mapSrc}" alt="מפת המסע של ${esc(item.name)}, התחנות ממוספרות לפי הרשימה" width="760" height="760">
      ${stationsOl()}
    </div>
  </section>` : '';

  const foot = (n) => `<div class="foot">
  <div class="txt">${two ? `<div class="pn">עמוד ${n} מתוך 2</div>` : ''}
    <div>© כל הזכויות שמורות ל<b>${SITE_NAME}</b></div>
    <div>השנים לבריאה לפי סדר עולם${hasRes ? '; <span class="rsn">בכחול - לפי המחקר</span>' : ''}</div>
    <div dir="ltr" style="text-align:end">${esc(gate.replace('https://', ''))}</div>
  </div>
  <div class="qr"><span>סרקו<br>לכרטיס<br>באתר</span>${qrSvg(live)}</div>
</div>`;
  const head = `<div class="top"><div class="brand">${SITE_NAME}</div><div class="kind">${esc(KIND_LABELS[item.kind] || '')}</div></div>
<h1>${esc(item.name)}</h1>
${research
    /* כמו בכרטיס: כשיש שנה מחקרית, שתי השורות מקבלות תווית - שתי שיטות, לא טעות */
    ? `<div class="years">${esc(formatRangeAM(item.start, item.end))} לבריאה</div>
<div class="yr2"><span class="k">לפי סדר עולם: </span>${esc(formatRangeSecular(item.start, item.end))}</div>
<div class="yr2 res"><span class="k">לפי המחקר: </span>${esc(research)}</div>`
    : `<div class="years">${esc(formatRangeAM(item.start, item.end))} לבריאה <span>· ${esc(formatRangeSecular(item.start, item.end))}</span></div>`}
<div class="facts">
  ${era ? `<div>תקופה: <b>${esc(era.name)}</b> (${esc(formatRangeAM(era.start, era.end).replace(/ \(.*\)$/, ''))})</div>` : ''}
  ${dur ? `<div>${item.reignText ? 'מלך' : 'משך'}: <b>${esc(dur)}</b></div>` : ''}
  ${item.kings ? `<div>בימי: <b>${esc(item.kings)}</b></div>` : ''}
</div>
${item.verse ? `<div class="verse">"${esc(item.verse)}"${item.verseRef ? `<small>${esc(item.verseRef)}</small>` : ''}</div>` : ''}
<p class="desc">${esc(item.description || '')}</p>`;
  // בלי נביאים ואירועים (אלה) - בני התקופה על כל הרוחב, ולא בחצי עמוד עם חצי ריק
  const cols = `<div class="cols${prophets.length || events.length ? '' : ' solo'}">
  <section><h2>דמויות מתקופתו</h2><div class="chips">${chips(people.slice(0, nPeople)) || '<span class="note">-</span>'}</div></section>
  <section>${prophets.length ? `<h2>נביאים בימיו</h2><div class="chips">${chips(prophets)}</div>` : ''}
  ${events.length ? `<h2>אירועים בימיו</h2><ul class="events">${events.slice(0, nEvents).map((e) => `<li><b>${esc(e.name)}</b> <span class="note">${esc(formatRangeAM(e.start, e.end).replace(/ \(.*\)$/, ''))}</span>${researchShort(e.id) ? ` <span class="rs">· לפי המחקר ${esc(researchShort(e.id))}</span>` : ''}</li>`).join('')}</ul>` : ''}
  </section>
</div>
${item.source || books.length ? `<div class="src">${item.source ? `מקור: ${esc(item.source)}` : ''}${books.length ? `${item.source ? ' · ' : ''}ספרי התנ"ך של התקופה: ${books.map((b) => esc(b.name)).join(', ')}` : ''}</div>` : ''}`;
  /* שני עמודים: בראשון הדמות ותחנות חייה (טקסט), בשני המפה הגדולה ובני התקופה.
     חלוקה לפי נושא (דמות / מסע) השאירה את העמוד הראשון של דוד ריק בשליש - יש
     לו רק שלושה בני תקופה. כך כל עמוד מקבל גם טקסט וגם תוכן מהנתונים. */
  const pageHtml = two
    ? `<div class="page" data-max="1.45"><main class="content">${head}
<section class="route"><h2>תחנות בחייו <span class="hint">· המספרים כמו במפה שבעמוד 2</span></h2>${stationsOl()}</section>
</main>${foot(1)}</div>
<div class="page p2" data-max="1.45"><main class="content">
<div class="top"><div class="brand">${SITE_NAME}</div><div class="kind">${esc(item.name)}</div></div>
<section class="map2"><h2>${mapTitle()}</h2>
<img src="${mapSrc}" alt="מפת המסע של ${esc(item.name)}, התחנות ממוספרות לפי הרשימה בעמוד 1" width="1100" height="1100"></section>
${cols}</main>${foot(2)}</div>`
    : `<div class="page"><main class="content">${head}${mapBlock}${cols}</main>${foot(1)}</div>`;

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(item.name)} - ${SITE_NAME}</title>
${web ? `<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${gate}">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">` : ''}
<style>
${faceCss(fs.head, fontSrc)}
${fs.body !== fs.head ? faceCss(fs.body, fontSrc) : ''}
:root{--fh:'${fs.head}',serif;--fb:'${fs.body}',${fs.bodyGeneric}}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--fb);color:#2b2416;background:#e9e2d2;-webkit-print-color-adjust:exact;print-color-adjust:exact}
/* סרגל העמוד באתר - לא מודפס */
.bar{position:sticky;top:0;z-index:2;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;
  padding:10px 12px;background:#163a57;color:#fff;font-size:15px}
.bar a,.bar button{font:inherit;font-weight:700;border-radius:999px;padding:8px 18px;text-decoration:none;cursor:pointer;border:0}
.bar a.dl{background:#f2c14e;color:#2b2416;border:0}
.bar button{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.55)}
.bar a{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.55)}
.bar button:focus-visible,.bar a:focus-visible{outline:3px solid #fff;outline-offset:2px}
.bar small{flex-basis:100%;text-align:center;opacity:.85;font-size:12.5px}
/* מתג "עמוד אחד | שני עמודים" - שני עמודים נפרדים באתר, כל אחד מותאם לעצמו */
.bar .seg{display:flex;border:1.5px solid rgba(255,255,255,.55);border-radius:999px;padding:2px;gap:2px}
.bar .seg a{border:0;padding:6px 14px;font-weight:600}
.bar .seg a[aria-current]{background:#fff;color:#163a57;font-weight:700}
.stage{padding:16px 0 24px}
/* העמוד עצמו: A4 בדיוק. במסך מוקטן לרוחב החלון (--fit), בהדפסה בגודל מלא */
.page{width:210mm;height:297mm;overflow:hidden;margin:0 auto;padding:11mm 13mm 9mm;display:flex;flex-direction:column;
  background:#fbf5e7;font-size:10.4pt;line-height:1.5;box-shadow:0 2px 14px rgba(0,0,0,.18);zoom:var(--fit,1)}
@media print{body{background:#fbf5e7}.bar{display:none}.stage{padding:0}.page{box-shadow:none;zoom:1}}
/* .content מוגדל ב-zoom עד שהוא ממלא את העמוד (FIT_JS); הרוחב מחולק באותו
   מקדם, כדי שאחרי ההגדלה הוא יחזור בדיוק לרוחב העמוד */
.content{width:calc(184mm / var(--z,1));zoom:var(--z,1)}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b28a2b;padding-bottom:5px}
.brand{font-family:var(--fh);font-weight:900;font-size:12.5pt;color:#163a57}
.kind{font-size:9pt;font-weight:700;color:#fff;background:${color};padding:2px 10px;border-radius:999px}
h1{font-family:var(--fh);font-weight:900;font-size:30pt;line-height:1.1;margin:10px 0 2px;color:#163a57}
.years{font-weight:700;color:#5b4a2a;font-size:10.5pt}
.years span{color:#6b5a3e;font-weight:500}
.yr2{font-size:9.5pt;color:#5b4a2a}
.yr2 .k{color:#6b5a3e;font-weight:500}
.yr2.res{color:#245c93;font-weight:700}
.chip em{font-style:normal;color:#245c93}
.events .rs{color:#245c93;font-size:8pt}
.facts{display:flex;flex-wrap:wrap;gap:4px 18px;margin:6px 0 8px;font-size:9.5pt;color:#4a3d25}
.facts b{color:#163a57}
.verse{border-inline-start:4px solid #b28a2b;background:#f3e8cc;padding:6px 12px;margin:6px 0 10px;
  border-start-end-radius:8px;border-end-end-radius:8px;font-family:var(--fh);font-size:12.5pt;font-weight:700;color:#3d2f12}
.verse small{display:block;font-family:var(--fb);font-size:8.5pt;font-weight:500;color:#7a5b16}
.desc{text-align:justify;margin:0 0 10px}
h2{font-family:var(--fh);font-weight:900;font-size:13pt;color:#163a57;margin:10px 0 5px;
  border-bottom:1px solid #e2d3b0;padding-bottom:2px}
.map-row{display:grid;grid-template-columns:104mm 1fr;gap:10px;align-items:start}
.map img{width:104mm;height:104mm;border-radius:6px;border:1px solid #d9c79c;display:block}
.map ol{margin:0;padding-inline-start:20px;font-size:9pt;line-height:1.35}
.map li{margin-bottom:3px}
.map li small{display:block;color:#6b5a3e;font-size:8pt}
.map li .nt{color:#9c2b50}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px}
.cols.solo{grid-template-columns:1fr}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{display:inline-flex;align-items:center;gap:5px;background:#fff8e8;border:1px solid #e2d3b0;border-radius:999px;
  padding:1px 9px;font-size:9pt;font-weight:700;white-space:nowrap}
.chip i{width:7px;height:7px;border-radius:50%;display:inline-block}
.chip small{font-weight:500;color:#6b5a3e;font-size:8pt}
.events{margin:0;padding-inline-start:18px;font-size:9pt}
.src{font-size:8.5pt;color:#6b5a3e;margin-top:8px}
.note{font-size:7.5pt;color:#6b5a3e}
.foot{margin-top:auto;padding-top:6px;border-top:1px solid #d9c79c;display:flex;align-items:center;gap:12px;
  font-size:8pt;color:#6b5a3e}
.foot .txt{flex:1;display:flex;flex-direction:column;gap:2px}
.foot b{color:#163a57}
.foot .rsn{color:#245c93;font-weight:700}
.qr{display:flex;align-items:center;gap:6px;color:#163a57;font-weight:700;font-size:7.5pt;line-height:1.3;text-align:end}
.qr svg{width:20mm;height:20mm;display:block}
.pn{font-weight:700;color:#163a57}
.stage .page + .page{margin-top:16px}
@media print{.stage .page + .page{margin-top:0}}
/* העמוד השני בגרסת שני העמודים: המסע. המפה רחבה ממרכז, והתחנות בעמודות מתחתיה */
.map2 img{width:140mm;height:140mm;margin:4px auto 6px;display:block;border-radius:6px;border:1px solid #d9c79c}
.route ol{margin:0;padding-inline-start:20px;font-size:10pt;line-height:1.35;columns:2;column-gap:18px}
.route li{margin-bottom:5px;break-inside:avoid}
.route li small{display:block;color:#6b5a3e;font-size:8.5pt}
.route li .nt{color:#9c2b50}
.hint{font-family:var(--fb);font-size:8.5pt;font-weight:500;color:#6b5a3e}
</style></head><body>
${web ? `<div class="bar">
  ${layouts && layouts.two ? `<nav class="seg" aria-label="פריסת הדף">
    <a href="${layouts.one}"${two ? '' : ' aria-current="page"'}>עמוד אחד</a><a href="${layouts.two}"${two ? ' aria-current="page"' : ''}>שני עמודים</a>
  </nav>` : ''}
  <a class="dl" id="dl" href="/api/sheet-pdf?k=${key}${two ? '&amp;p=2' : ''}" download>⬇️ הורדת PDF</a>
  <button type="button" id="print">🖨️ הדפסה</button>
  <a href="/?sel=${key}&amp;src=sheet-page">← ל${esc(item.name)} באתר</a>
  <small id="dlnote">ההורדה מכינה קובץ PDF - לוקח כמה שניות</small>
</div>` : ''}
<div class="stage">${pageHtml}
<script>${FIT_JS}</script>
</body></html>`;
}
