// מייצר דפי-נחיתה סטטיים (HTML מוכן לגוגל) לכל דמות/אירוע/ספר, וכן
// sitemap.xml, robots.txt ודף אינדקס. רץ אחרי `vite build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hebrewYearLetters, toSecular, formatRange } from '../src/utils/dates.js';
import { sourceSegments } from '../src/utils/sefaria.js';
import { buildPlaceIndex, relatedByPlace } from '../src/utils/related.js';
import { journeyStations } from '../src/utils/mapProject.js';
import { writeCard } from './og.mjs';
import { writeHero, writePlaceHero } from './hero.mjs';

/* הפתיח המצויר: לכל פריט עם מסע גיאוגרפי מתועד (64 פריטים - אבות,
   שופטים, מלכים, נביאים) רצועת מפה עם תחנות המסע; לכל פריט בלעדיו
   (94 פריטים - אירועים, ספרים, רקע עולמי, ודמויות בלי תחנות
   מתועדות) רצועת ציר-זמן במקומה - אין להם מה למקם על מפה, אבל יש
   להם תמיד מיקום בזמן, באותה שפה חזותית של פסים ונקודות שכבר
   מוכרת מציר הזמן עצמו, רק חתוכה לחלון קטן סביב הפריט. וקטורי
   לגמרי (SVG מוטבע), בלי קובץ תמונה לצרוב. hasMap נגזר תמיד
   מ-maps.json עצמו, לא מרשימת אישור - אין יותר "פיילוט". */
const KIND_COLOR = {
  leader: '#9c2b50', judge: '#bd7038', united: '#6a3ca0', judah: '#245c93', israel: '#4f7a33',
  prophet: '#b3781a', book: '#157a70', event: '#b0392c', world: '#8a7250',
};
const HERO_SIZE = { w: 1080, h: 490 };   // פס עליון (טלפון/טאבלט)
const HERO_SPLIT = { w: 1100, h: 1003 }; // עמודה מאונכת (מחשב) - גדל עם הכרטיס

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const DATA = join(ROOT, 'src', 'data');
const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

const SITE = 'https://simpleisrael.co.il';
const leaders = read('leaders.json');
const judges = read('judges.json');
const kings = read('kings.json');
const prophets = read('prophets.json');
const books = read('books.json');
const world = read('world.json');
const events = read('events.json');
const periods = read('periods.json');
const collections = read('collections.json');
const placesIndex = read('places.json');

const KINDS = {
  leader: { label: 'מנהיג', schema: 'Person', group: 'אבות ומנהיגים' },
  judge: { label: 'שופט', schema: 'Person', group: 'שופטים' },
  united: { label: 'מלך הממלכה המאוחדת', schema: 'Person', group: 'מלכים' },
  judah: { label: 'מלך יהודה', schema: 'Person', group: 'מלכים' },
  israel: { label: 'מלך ישראל', schema: 'Person', group: 'מלכים' },
  prophet: { label: 'נביא', schema: 'Person', group: 'נביאים' },
  // CreativeWork ולא Book, ו-Thing ולא Event: שני האחרונים נבדקים ע"י גוגל
  // לתוצאות עשירות ודורשים שדות שאין לתוכן מקראי (ISBN, startDate, location)
  book: { label: 'ספר תנ״ך', schema: 'CreativeWork', group: 'ספרי תנ״ך' },
  world: { label: 'דמות עולמית', schema: 'Person', group: 'רקע עולמי' },
  event: { label: 'אירוע', schema: 'Thing', group: 'אירועים' },
};

const items = [
  ...leaders.map((x) => ({ ...x, kind: 'leader' })),
  ...judges.map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...prophets.map((x) => ({ ...x, kind: 'prophet' })),
  ...books.map((x) => ({ ...x, kind: 'book' })),
  ...world.map((x) => ({ ...x, kind: 'world' })),
  ...events.map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
];

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s = '') => esc(s).replace(/"/g, '&quot;');
const clean = (s = '') => String(s).replace(/\s+/g, ' ').trim();
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trim() + '…');
const urlOf = (it) => `${SITE}/p/${it.kind}/${it.id}`;

// שכנים באותה קטגוריה (לקישורים פנימיים לזחילה)
const byKind = {};
for (const it of items) (byKind[it.kind] ||= []).push(it);
for (const k in byKind) byKind[k].sort((a, b) => a.start - b.start);

// חפיפה בזמן - אותה הגדרה כמו "בני-הזמן" באפליקציה
function overlaps(a, b) {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
}
const MAX_CONTEMP = 16;
const contemporariesOf = (it) =>
  items.filter((o) => !(o.kind === it.kind && o.id === it.id) && overlaps(it, o))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CONTEMP);

// התקופה שבה הפריט מתחיל
const sortedPeriods = [...periods].sort((a, b) => a.start - b.start);
const periodAt = (year) =>
  sortedPeriods.find((p) => year >= p.start && year < p.end)
  || sortedPeriods.find((p) => year >= p.start && year <= p.end)
  || null;
const periodOf = (it) => periodAt(it.start);
const periodUrl = (p) => `${SITE}/p/period/${p.id}`;
const itemsInPeriod = (p) =>
  items.filter((it) => overlaps(it, p)).sort((a, b) => a.start - b.start);

// אינדקס מקומות ל"אותו מקום"
const maps = read('maps.json');
const placeIndex = buildPlaceIndex(maps);
const byId = (id) => items.find((x) => x.id === id) || null;

/* ---- רצועת ציר-זמן (פיילוט שני) ----
   שכנים לרצועה: לא מספיק "חופף בכלל" - פריט כמו מלך שרוב מלכותו
   מחוץ לחלון ורק קצה אחד נוגע בו נראה כאילו הוא הפריט המרכזי (בר
   ענק שנחתך בשוליים). דורשים חפיפה אמיתית: לפחות 8% מרוחב החלון.
   וגם לא ספר כמו "דברי הימים" שמשתרע על כמעט כל הציר - פריט ארוך
   בהרבה מהחלון עצמו לא "שכן", הוא רקע. */
function sliverNeighbors(it, yMin, yMax, max = 5) {
  const windowSpan = yMax - yMin;
  const minOverlap = Math.max(8, Math.round(windowSpan * 0.08));
  const maxSpan = windowSpan * 1.8;
  return items
    .filter((o) => {
      if (o === it) return false;
      if (o.start === o.end) return o.start >= yMin && o.start <= yMax;
      if (o.end - o.start > maxSpan) return false;
      return Math.min(o.end, yMax) - Math.max(o.start, yMin) >= minOverlap;
    })
    .sort((a, b) => a.start - b.start)
    .slice(0, max)
    .map((o) => ({ name: o.name, start: o.start, end: o.end, color: KIND_COLOR[o.kind] || '#8a7250' }));
}

/* שיבוץ שכבות: כל פריט נכנס לשורה הראשונה שהוא באמת לא חופף בה -
   בפיקסלים, לפי רוחב התווית המשוער, לא לפי טווח השנים של המקום
   עצמו. שני פריטים סמוכים בזמן (כמו ספר שמסתיים בדיוק כשמתחיל
   האירוע הבא) לא חופפים כסמן, אבל שתי התוויות הרחבות מעליהם כן
   היו מתנגשות בלי הבדיקה הזו. */
function packLanes(list, sx) {
  const lanes = [];
  const placed = [];
  for (const it2 of list) {
    const cx1 = sx(it2.start), cx2 = sx(it2.end);
    const half = Math.max(16, it2.name.length * 2.8);
    const spanL = Math.min(cx1, cx2) - half, spanR = Math.max(cx1, cx2) + half;
    let lane = lanes.findIndex((ivs) => ivs.every((iv) => spanR <= iv.l || spanL >= iv.r));
    if (lane === -1) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push({ l: spanL, r: spanR });
    placed.push({ ...it2, lane });
  }
  return placed;
}

// מוקדם = ימין (x גדול), מאוחר = שמאל (x קטן) - כמו ציר הזמן האמיתי (RTL)
// הגובה משתנה לפי מספר השורות שבאמת בשימוש - כדי ששורת הפריט המרכזי
// למטה לעולם לא תתנגש עם תווית של שכן, גם כשיש מעט שכנים וגם כשיש חמישה
function sliverSvg(own, ownColor, neighbors, yMin, yMax) {
  const W = 560, padX = 16, padTop = 18, laneH = 25, ownArea = 72;
  const sx = (y) => padX + (W - padX * 2) - ((y - yMin) / (yMax - yMin)) * (W - padX * 2);
  const placed = packLanes(neighbors, sx);
  const laneCount = placed.reduce((m, n) => Math.max(m, n.lane + 1), 0);
  const lanesBottom = padTop + laneCount * laneH;
  const baseY = lanesBottom + ownArea;
  const H = baseY + 22;
  const esc2 = escAttr;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc2(`${own.name} על ציר הזמן`)}">`;
  s += `<line class="sl-axis" x1="${padX}" x2="${W - padX}" y1="${baseY}" y2="${baseY}"/>`;
  [yMin, yMax].forEach((y) => {
    const px = sx(y);
    s += `<line class="sl-tick" x1="${px}" x2="${px}" y1="${baseY - 3}" y2="${baseY + 3}"/>`;
    s += `<text class="sl-tick-label" x="${px}" y="${baseY + 15}" text-anchor="${y === yMin ? 'end' : 'start'}">${y}</text>`;
  });
  placed.forEach((n) => {
    const y = padTop + n.lane * laneH + 9;
    // קיצוץ לגבולות המסגרת - שכן שרובו מחוץ לחלון לא ידחוף בר ענק
    // מעבר לציר, גם אם החפיפה שהצדיקה את הכללתו קטנה
    const x1 = sx(Math.max(n.start, yMin)), x2 = sx(Math.min(n.end, yMax));
    if (n.start === n.end) s += `<circle class="sl-bar" cx="${x1}" cy="${y}" r="4.5" fill="${n.color}"/>`;
    else s += `<rect class="sl-bar" x="${Math.min(x1, x2)}" y="${y - 4.5}" width="${Math.max(3, Math.abs(x2 - x1))}" height="9" rx="4.5" fill="${n.color}"/>`;
    s += `<text class="sl-bar-label" x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle">${esc(n.name)}</text>`;
  });
  const oy = baseY - 28;
  const ox1 = sx(own.start), ox2 = sx(own.end);
  if (own.start === own.end) s += `<circle class="sl-own-mark" cx="${ox1}" cy="${oy}" r="7.5" fill="${ownColor}"/>`;
  else s += `<rect class="sl-own-mark" x="${Math.min(ox1, ox2)}" y="${oy - 6.5}" width="${Math.max(7, Math.abs(ox2 - ox1))}" height="13" rx="6.5" fill="${ownColor}"/>`;
  s += `<text class="sl-own-label" x="${(ox1 + ox2) / 2}" y="${oy - 15}" text-anchor="middle" fill="${ownColor}">${esc(own.name)}</text>`;
  s += `<text class="sl-own-year" x="${(ox1 + ox2) / 2}" y="${oy + 20}" text-anchor="middle">${own.start === own.end ? own.start : `${own.start}–${own.end}`}</text>`;
  s += '</svg>';
  return s;
}

const STYLE = `
@font-face{font-family:'Frank Ruhl Libre';font-weight:500 900;font-display:swap;src:url('/fonts/frankruhllibre-hebrew.woff2') format('woff2');unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:'Frank Ruhl Libre';font-weight:500 900;font-display:swap;src:url('/fonts/frankruhllibre-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Heebo';font-weight:300 700;font-display:swap;src:url('/fonts/heebo-hebrew.woff2') format('woff2');unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
:root{--bg:#efe4c8;--panel:#fbf5e7;--ink:#33281a;--muted:#6d5c42;--navy:#163a57;--gold:#b28a2b;--line:#dcc9a3}
*{box-sizing:border-box}
/* "קראו כאן" הוא עיגון בתוך אותו הדף - קפיצה מיידית למקום משאיר
   אותו, ונראית כמעבר לדף אחר. מכבדים prefers-reduced-motion */
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Frank Ruhl Libre','Heebo',Georgia,serif;line-height:1.7}
.wrap{max-width:720px;margin:0 auto;padding:20px 18px 48px}
header a{color:var(--navy);text-decoration:none;font-weight:700;font-size:15px}
.crumbs{font-size:12.5px;color:var(--muted);margin:14px 0 -8px}
.crumbs a{color:var(--gold);text-decoration:none}
.crumbs a:hover{text-decoration:underline}
.crumbs .sep{opacity:.6}
.chip{display:inline-block;font-size:12px;font-weight:700;color:var(--gold);letter-spacing:.3px;margin:22px 0 4px}
h1{margin:0 0 6px;font-size:32px;color:var(--navy);font-weight:900}
.dates{color:var(--muted);font-size:15px;margin-bottom:16px}
.row{margin:6px 0;font-size:15px}
.row b{color:var(--navy)}
.desc{font-size:17px;line-height:1.85;margin:16px 0}
.verse{margin:18px 0;padding:12px 16px;border-inline-start:3px solid var(--gold);background:linear-gradient(180deg,#fff9ec,#f6ecd4);border-radius:0 10px 10px 0;font-size:17px;line-height:1.8;color:var(--navy)}
.verse .vtext::before,.verse .vtext::after{content:'״';opacity:.5}
.verse cite{display:block;margin-top:6px;font-size:13px;font-style:normal;color:var(--gold);font-weight:700}
.src{font-size:14px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:20px}
.src a{color:var(--gold);font-weight:700;text-decoration:none;border-bottom:1px dotted var(--gold)}
.cta{display:inline-block;margin:22px 0 8px;background:var(--navy);color:#fff;text-decoration:none;border-radius:22px;padding:12px 22px;font-size:16px;font-weight:700}
.ctas{display:flex;flex-wrap:wrap;gap:10px}
.cta.ghost{background:transparent;color:var(--navy);border:2px solid var(--navy);padding:10px 20px}
.cta.ghost:hover{background:var(--navy);color:#fff}
nav.rel{display:flex;justify-content:space-between;gap:10px;margin-top:26px;border-top:1px solid var(--line);padding-top:16px;font-size:14px}
nav.rel a{color:var(--navy);text-decoration:none;font-weight:600;max-width:46%}
footer{margin-top:34px;font-size:13px;color:var(--muted)}
footer a{color:var(--gold)}
.idx h2{color:var(--navy);font-size:20px;margin:26px 0 8px;border-bottom:2px solid var(--gold);padding-bottom:4px}
.idx ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px 14px}
.idx a{color:var(--navy);text-decoration:none;font-size:15px}
.idx a:hover{color:var(--gold)}
.dim{color:var(--muted);font-size:13px}
.related{margin-top:30px;border-top:1px solid var(--line);padding-top:16px}
.related h2{margin:0 0 4px;font-size:20px;color:var(--navy)}
.related-sub{margin:0 0 12px;font-size:14px;color:var(--muted)}
.chips{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px}
.chips a{display:flex;flex-direction:column;gap:1px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:6px 11px;text-decoration:none}
.chips a:hover{border-color:var(--gold)}
.cl-name{color:var(--navy);font-size:14.5px;font-weight:700}
.cl-kind{color:var(--muted);font-size:11px}
.mlist{list-style:none;padding:0;margin:14px 0 0;counter-reset:m}
.mlist li{counter-increment:m;position:relative;padding:12px 40px 12px 0;border-top:1px solid var(--line)}
.mlist li::before{content:counter(m);position:absolute;right:0;top:13px;width:26px;height:26px;
  border-radius:50%;background:var(--panel);border:1px solid var(--line);color:var(--gold);
  font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
.mlist a{color:var(--navy);text-decoration:none;font-size:17px}
.mlist a:hover b{color:var(--gold)}
.mlist .dim{margin-inline-start:8px}
.mlist p{margin:4px 0 0;font-size:15px;line-height:1.75;color:var(--muted)}
/* שער הכניסה - הדבר הראשון בדף. הכותרת, ומיד אחריה הבחירה באיזה מבט
   להיכנס לאתר עצמו. הטקסט המלא ממשיך מתחתיו. */
.gate{margin:14px 0 8px;background:linear-gradient(180deg,#fdf8ec,#f4e9d1);
  border:1px solid var(--line);border-radius:18px;padding:20px 18px 16px;
  box-shadow:0 10px 26px rgba(90,70,30,.09)}
.gate .chip{margin:0 0 2px}
.gate h1{font-size:34px;margin:0 0 4px}
.gate .dates{margin:0 0 8px}
.gate .lead{margin:0 0 12px;font-size:16px;line-height:1.7;color:var(--muted)}
.gate-q{margin:0 0 10px;font-size:15px;font-weight:700;color:var(--navy)}
.gopts{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:10px}
.gopt{display:flex;align-items:center;gap:11px;background:#fffdf7;border:1.5px solid var(--line);
  border-radius:14px;padding:12px 14px;text-decoration:none;transition:border-color .15s,transform .15s}
.gopt:hover{border-color:var(--gold);transform:translateY(-1px)}
.gopt .gi{font-size:23px;line-height:1}
.gopt .gt{display:block;color:var(--navy);font-weight:700;font-size:16.5px}
.gopt .gs{display:block;color:var(--muted);font-size:12.5px;line-height:1.45}
/* גרסת הפתיח עם רצועת מפה: התמונה היא חלק מהכרטיס, והבחירה נפרשת
   כשלוש שורות רחבות - הראשונה מלאה בכחול, כדי שהמעבר לאתר יהיה
   הדבר הבולט בדף ולא הערת שוליים. */
.gate-hero{padding:0;overflow:hidden}
.gate-body{padding:14px 18px 16px}
.hero{display:block;position:relative;line-height:0;text-decoration:none}
.hero img{width:100%;height:auto;display:block}
.hero::after{content:'';position:absolute;inset-inline:0;bottom:-1px;height:58px;
  background:linear-gradient(180deg,rgba(253,248,236,0),rgba(253,248,236,.96))}
.hero-tag{position:absolute;z-index:1;inset-inline-end:12px;bottom:11px;line-height:1.45;
  background:rgba(22,58,92,.93);color:#fdf6e6;font-size:13.5px;font-weight:700;
  padding:7px 13px;border-radius:999px;box-shadow:0 4px 12px rgba(20,40,60,.25)}
.hero:hover .hero-tag{background:var(--gold);color:#20180a}
/* רצועת ציר-זמן - חלופה למפה כשאין מסע גיאוגרפי (אירוע/ספר/רקע עולמי/
   דמות בלי תחנות). אותו מכל (.hero) ואותה תווית פינתית, בלי תמונה -
   ה-SVG וקטורי לגמרי כך שאין קובץ נפרד לצרוב בבנייה. */
.hero.sliver{line-height:normal;display:flex;flex-direction:column;justify-content:center;
  background:#f4e9d1;padding:26px 24px}
.hero.sliver::after{display:none}
.sliver-period{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.3px;margin:0 0 10px}
.sliver-period b{color:var(--ink)}
.hero.sliver svg{display:block;width:100%;height:auto;overflow:visible}
.sl-axis{stroke:var(--line);stroke-width:1.5}
.sl-tick{stroke:var(--line);stroke-width:1}
.sl-tick-label{font-family:'Heebo',sans-serif;font-size:10px;fill:var(--muted)}
.sl-bar{opacity:.38}
.sl-bar-label{font-family:'Heebo',sans-serif;font-size:10px;font-weight:600;fill:var(--muted)}
.sl-own-mark{stroke:#f4e9d1;stroke-width:2}
.sl-own-label{font-family:'Frank Ruhl Libre',serif;font-size:13px;font-weight:700}
.sl-own-year{font-family:'Heebo',sans-serif;font-size:10px;font-weight:600;fill:var(--muted)}
.gopts.big{grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
.gopt.big{flex-direction:column;text-align:center;border-width:2px;border-radius:16px;
  padding:14px 10px 13px;gap:7px}
.gopt.big .gi{flex:0 0 auto;width:46px;height:46px;border-radius:50%;background:#f3e8ce;
  display:inline-flex;align-items:center;justify-content:center;font-size:24px}
.gopt.big .gt{font-size:18.5px}
.gopt.big .gs{font-size:13px;line-height:1.45}
.gopt.big .garrow{display:none;flex:0 0 auto;color:var(--gold);font-size:23px;font-weight:700;line-height:1}
.gopt.big:hover{box-shadow:0 8px 18px rgba(90,70,30,.12)}
.gopt.big.primary{background:var(--navy);border-color:var(--navy)}
.gopt.big.primary .gt{color:#fff}
.gopt.big.primary .gs{color:#c9dcec}
.gopt.big.primary .gi{background:rgba(255,255,255,.15)}
.gopt.big.primary .garrow{color:#e7c86a}
.gopt.big.primary:hover{background:#1d4a70;border-color:#1d4a70}
.gread{display:inline-block;margin-top:14px;font-size:14px;font-weight:700;color:var(--gold);text-decoration:none}
.gread:hover{text-decoration:underline}
#more{scroll-margin-top:12px}
#more>h2:first-child{margin:26px 0 10px;font-size:20px;color:var(--navy);
  border-bottom:2px solid var(--gold);padding-bottom:4px}
@media (max-width:520px){
  .gate{padding:16px 14px 14px}
  .gate-hero{padding:0}
  .gate-body{padding:14px 14px 14px}
  .gate h1{font-size:29px}
  .gopts{grid-template-columns:1fr}
  .hero-tag{font-size:12.5px;padding:6px 11px;inset-inline-end:9px;bottom:9px}
}
/* בטלפון שלוש עמודות הופכות לשלוש שורות רחבות - כל אחת יעד מגע גדול
   עם חץ בקצה, ולא שלושה ריבועים צרים */
@media (max-width:640px){
  /* רצועה של 2:1 היא פס דק במסך צר: חותכים מעט מהצדדים (בעיקר ים)
     כדי שהמפה תקבל נוכחות אמיתית גם בטלפון */
  .hero img{aspect-ratio:16/10;height:auto;object-fit:cover}
  .gopts.big{grid-template-columns:1fr;gap:10px}
  .gopt.big{flex-direction:row;text-align:start;gap:12px;padding:12px 13px;min-height:70px}
  .gopt.big .gtx{flex:1 1 auto}
  .gopt.big .gi{width:44px;height:44px;font-size:23px}
  .gopt.big .gt{font-size:18px}
  .gopt.big .garrow{display:block}
  .wrap.bare{padding:0 12px 24px}
}
/* מחשב: הכרטיס נפתח לשתי עמודות - הבחירה מימין, המפה משמאל וממלאת
   את מלוא גובה הכרטיס. זה גם מוותר על החיתוך הרחב לטובת חיתוך מאונך
   (picture/source), כדי שהמפה לא תיחתך אלא תראה יותר ארץ. הכרטיס
   גדל ל-1200 כדי שיתפוס נתח משמעותי יותר מהמסך; ב-HERO_SPLIT יש
   רזולוציה שתומכת ברוחב הזה בלי להיטשטש. */
.wrap.wide{max-width:1200px}
/* הכרטיס תופס את המסך הראשון לבדו ויושב במרכזו; הגלילה חושפת
   את הטקסט המלא מתחתיו, ברוחב קריא של 720. safe מונע חיתוך של הראש
   כשהכרטיס גבוה מהמסך. */
.wrap.bare{padding-top:0;padding-bottom:40px}
.screen{min-height:100dvh;display:flex;flex-direction:column;justify-content:safe center;padding:20px 0}
.below{max-width:720px;margin:0 auto}
/* איור מאחורי הכרטיס נוסה ונפסל - גזל תשומת לב מהבחירה עצמה. המסך
   שמאחורי הכרטיס הוא עכשיו אותו קלף שטוח כמו שאר האתר (var(--bg)),
   בדיוק כמו מסך הפתיחה של האפליקציה; רק צל עדין נשאר כדי שהכרטיס
   עדיין ירחף מעל הרקע. */
body.bg-og .gate-hero{box-shadow:0 10px 30px rgba(60,45,20,.14)}
.wrap.wide footer{max-width:720px;margin-inline:auto}
@media (min-width:860px){
  .gate-hero.split{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);align-items:stretch}
  .gate-hero.split .hero{grid-area:1/2;height:100%}
  .gate-hero.split .hero picture{display:block;height:100%}
  .gate-hero.split .hero img{width:100%;height:100%;object-fit:cover;aspect-ratio:auto}
  /* התפר בין המפה לעמודת הטקסט: המפה נחתכת שם באמצע תוויות משלה,
     והמעבר הרך אל הקלף מסתיר את השאריות */
  .gate-hero.split .hero::after{display:block;top:0;bottom:0;right:0;left:auto;width:64px;height:auto;
    background:linear-gradient(to left,rgba(253,248,236,.92),rgba(253,248,236,0))}
  /* לרצועה אין קצה תמונה שצריך להסתיר - הרקע שלה כבר קלף שטוח */
  .gate-hero.split .hero.sliver::after{display:none}
  .gate-hero.split .hero.sliver{padding:30px 32px}
  .gate-hero.split .gate-body{grid-area:1/1;display:flex;flex-direction:column;
    justify-content:center;padding:38px 40px}
  .gate-hero.split h1{font-size:46px;margin-bottom:6px}
  .gate-hero.split .lead{font-size:18px;margin-bottom:19px}
  .gate-hero.split .gate-q{font-size:17px;margin-bottom:13px}
  .gate-hero.split .gopts.big{grid-template-columns:1fr;gap:13px}
  .gate-hero.split .gopt.big{flex-direction:row;text-align:start;gap:16px;padding:16px 19px;min-height:88px}
  .gate-hero.split .gopt.big .gtx{flex:1 1 auto}
  .gate-hero.split .gopt.big .gi{width:50px;height:50px;font-size:26px}
  .gate-hero.split .gopt.big .gt{font-size:21px}
  .gate-hero.split .gopt.big .gs{font-size:14.5px}
  .gate-hero.split .gopt.big .garrow{display:block}
}
`;

/* ---- שער הכניסה ----
   מי שמגיע מגוגל נוחת על דף-הנחיתה ולא על האתר עצמו, וראה טקסט בלבד.
   הדף נשאר (הוא מה שגוגל מאנדקס), אבל הדבר הראשון שבו הוא הכותרת
   ומיד אחריה בחירה בין המבטים - וכל בחירה נפתחת כבר על מה שחיפשו.
   נכסי האפליקציה נטענים מראש ברקע כדי שהמעבר יהיה מיידי. */
const assetLinks = (entry) => {
  try {
    const html = readFileSync(join(DIST, entry), 'utf8');
    const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
    return urls.map((u) => (u.endsWith('.css')
      ? `<link rel="prefetch" as="style" href="${u}"/>`
      : `<link rel="prefetch" as="script" crossorigin href="${u}"/>`)).join('\n');
  } catch { return ''; } // הרצה ללא dist - פשוט בלי טעינה מראש
};
const PREFETCH = { main: assetLinks('index.html'), places: assetLinks('places.html') };

/* hero - רצועת מפה או רצועת ציר-זמן בראש השער (ראו hasMap למטה).
   כשהיא קיימת, הבחירה נפרשת כשורות רחבות ולא כשלושה ריבועים
   קטנים. */
function gate({ chip, name, dates, lead, question, opts, readLabel, hero, split }) {
  const big = hero ? ' big' : '';
  const inner = `<div class="chip">${esc(chip)}</div>
<h1>${esc(name)}</h1>
${dates ? `<div class="dates">${esc(dates)}</div>` : ''}
${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
<p class="gate-q">${esc(question)}</p>
<div class="gopts${big}">
${opts.map((o) => `  <a class="gopt${big}${o.primary ? ' primary' : ''}" href="${escAttr(o.href)}">`
    + `<span class="gi" aria-hidden="true">${o.icon}</span>`
    + `<span class="gtx"><span class="gt">${esc(o.title)}</span><span class="gs">${esc(o.sub)}</span></span>`
    + `${hero ? '<span class="garrow" aria-hidden="true">←</span>' : ''}</a>`).join('\n')}
</div>
${readLabel ? `<a class="gread" href="#more">${esc(readLabel)} ↓</a>` : ''}`;
  return hero
    ? `<div class="gate gate-hero${split ? ' split' : ''}">\n${hero}\n<div class="gate-body">\n${inner}\n</div>\n</div>`
    : `<div class="gate">\n${inner}\n</div>`;
}

// שלושת המבטים, עם היעד המדויק לכל דף
const optTimeline = (q = '') => ({ icon: '📜', href: `/${q}`, title: 'ציר הזמן', sub: 'לראות מי חי לצד מי' });
const optAtlas = (q = '') => ({ icon: '🗺️', href: `/atlas${q}`, title: 'מסע הדורות', sub: 'לעקוב אחרי המסע על המפה' });
const optPlaces = (q = '') => ({ icon: '📍', href: `/places${q}`, title: 'מפת המקומות', sub: 'לראות מה קרה בכל מקום' });

// פירורי לחם כניווט גלוי. בדף שהכרטיס פותח אותו הם יורדים מהראש
// ומוצגים בתחילת התוכן שמתחתיו, ולכן זו פונקציה ולא קוד בתוך shell.
const crumbsNav = (crumbs) => (crumbs && crumbs.length ? `
<nav class="crumbs" aria-label="מיקום באתר">${crumbs.map((c) =>
    c.url ? `<a href="${escAttr(c.url)}">${esc(c.name)}</a>` : `<span aria-current="page">${esc(c.name)}</span>`
  ).join('<span class="sep"> / </span>')}</nav>` : '');

function shell({ title, description, canonical, jsonld, body, ogImage, crumbs, prefetch = 'main',
  wide = false, bare = false, bodyClass = '' }) {
  const img = ogImage || `${SITE}/og-image.jpg`;
  // פירורי לחם: גם ניווט גלוי וגם BreadcrumbList לגוגל (מוצג בתוצאות החיפוש)
  const crumbLd = crumbs && crumbs.length ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name,
      ...(c.url ? { item: c.url } : {}),
    })),
  } : null;
  const ld = crumbLd ? [jsonld, crumbLd].filter(Boolean) : jsonld;
  const crumbsHtml = crumbsNav(crumbs);
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(description)}"/>
<link rel="canonical" href="${escAttr(canonical)}"/>
<link rel="preload" as="font" type="font/woff2" href="/fonts/frankruhllibre-hebrew.woff2" crossorigin/>
<link rel="preload" as="font" type="font/woff2" href="/fonts/heebo-hebrew.woff2" crossorigin/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="ציר הזמן של עם ישראל"/>
<meta property="og:title" content="${escAttr(title)}"/>
<meta property="og:description" content="${escAttr(description)}"/>
<meta property="og:url" content="${escAttr(canonical)}"/>
<meta property="og:image" content="${img}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:locale" content="he_IL"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escAttr(title)}"/>
<meta name="twitter:description" content="${escAttr(description)}"/>
<meta name="twitter:image" content="${img}"/>
<style>${STYLE}</style>
${PREFETCH[prefetch] || ''}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ''}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}><div class="wrap${wide ? ' wide' : ''}${bare ? ' bare' : ''}">
${bare ? '' : `<header><a href="/">← ציר הזמן של עם ישראל</a></header>
${crumbsHtml}`}
${body}
<footer>חלק מ<a href="/">ציר הזמן של עם ישראל</a> · מהאבות ועד חורבן בית שני · <a href="/p">מפת האתר</a></footer>
</div></body>
</html>`;
}

function itemPage(it) {
  const km = KINDS[it.kind];
  const desc = clean(it.description || '');
  const metaDesc = truncate(`${it.name} - ${km.label}. ${desc}`, 155);
  const dates = formatRange(it.start, it.end, 'tradition');
  const canonical = urlOf(it);

  const srcHtml = it.source
    ? sourceSegments(it.source).map((seg) =>
        seg.href
          ? `<a href="${escAttr(seg.href)}" target="_blank" rel="noopener">${esc(seg.text)}</a>`
          : esc(seg.text)
      ).join('; ')
    : '';

  const era = periodOf(it);
  const rows = [];
  // פריט ארוך (ספר, רקע עולמי) יכול לחצות כמה תקופות - "תקופה" יחידה
  // לפי תחילתו בלבד מציגה טווח שנים שנגמר הרבה לפני שהפריט עצמו נגמר
  if (era) {
    const eraEndRow = periodAt(it.end);
    rows.push(eraEndRow && eraEndRow.id !== era.id
      ? `<div class="row"><b>תקופה:</b> <a href="/p/period/${era.id}">${esc(era.name)}</a> ועד <a href="/p/period/${eraEndRow.id}">${esc(eraEndRow.name)}</a></div>`
      : `<div class="row"><b>תקופה:</b> <a href="/p/period/${era.id}">${esc(era.name)}</a> <span class="dim">(${era.start}–${era.end})</span></div>`);
  }
  if (it.reignText) rows.push(`<div class="row"><b>משך המלוכה:</b> ${esc(it.reignText)}</div>`);
  if (it.lifeText) rows.push(`<div class="row"><b>שנות חיים:</b> ${esc(it.lifeText)}</div>`);
  if (it.tenureText) rows.push(`<div class="row"><b>הנהגה:</b> ${esc(it.tenureText)}</div>`);
  if (it.kings) rows.push(`<div class="row"><b>בימי:</b> ${esc(it.kings)}</div>`);
  if (it.empire) rows.push(`<div class="row"><b>מעצמה:</b> ${esc(it.empire)}</div>`);

  const sibs = byKind[it.kind];
  const i = sibs.findIndex((s) => s.id === it.id);
  const prev = sibs[i - 1], next = sibs[i + 1];
  const rel = `<nav class="rel">
${prev ? `<a href="/p/${prev.kind}/${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="/p/${next.kind}/${next.id}">${esc(next.name)} →</a>` : '<span></span>'}
</nav>`;

  const ogImage = `${SITE}/og/${it.kind}/${it.id}.jpg`;
  // הדף מוצהר כ-WebPage, והנושא שלו יושב ב-about. קודם הצהרנו על דפי
  // האירועים כ-Event, ו-Search Console פסל את כולם: סכימת Event של גוגל
  // דורשת startDate ו-location, והיא מיועדת לאירועים שאפשר להשתתף בהם -
  // לא לאירוע היסטורי מלפני שלושת אלפים שנה שאין לו תאריך ISO. גם Book
  // הוחלף ב-CreativeWork, שדורש ISBN ו-workExample שאין לספרי התנ״ך.
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: it.name,
    description: desc,
    url: canonical,
    image: ogImage,
    inLanguage: 'he',
    isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
    about: { '@type': km.schema, name: it.name, description: truncate(clean(desc), 300) },
  };
  // פירורי לחם: בית ← התקופה ← הדמות (התקופה מקושרת לדף-התקופה שלה)
  const crumbs = [
    { name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
    era ? { name: era.name, url: periodUrl(era) } : { name: 'מפת האתר', url: SITE + '/p' },
    { name: it.name },
  ];

  const contemps = contemporariesOf(it);
  const contempHtml = contemps.length ? `
<section class="related">
  <h2>בני הזמן</h2>
  <p class="related-sub">מי שחי או התרחש במקביל ל${esc(it.name)}:</p>
  <ul class="chips">
    ${contemps.map((c) => `<li><a href="/p/${c.kind}/${c.id}"><span class="cl-name">${esc(c.name)}</span><span class="cl-kind">${esc(KINDS[c.kind].label)}</span></a></li>`).join('\n    ')}
  </ul>
</section>` : '';

  const places = relatedByPlace(it.id, placeIndex, byId);
  const placeHtml = places.length ? `
<section class="related">
  <h2>אולי יעניין אותך גם - אותו מקום</h2>
  <p class="related-sub">דמויות שקשורות לאותם מקומות כמו ${esc(it.name)}:</p>
  <ul class="chips">
    ${places.map((c) => `<li><a href="/p/${c.kind}/${c.id}"><span class="cl-name">${esc(c.name)}</span><span class="cl-kind">${esc(c.place)}</span></a></li>`).join('\n    ')}
  </ul>
</section>` : '';

  // המקומות שהדמות עברה בהם, מקושרים לדפי המקום - הציר השלישי
  const visited = placesIndex.filter((pl) => pl.visits.some((v) => v.id === it.id));
  const visitedHtml = visited.length ? `
<section class="related">
  <h2>המקומות במסע</h2>
  <p class="related-sub">איפה ${esc(it.name)} מופיע על המפה, ומי עוד עבר שם:</p>
  <ul class="chips">
    ${visited.map((pl) => `<li><a href="${placeHref(pl)}"><span class="cl-name">${esc(pl.name)}</span><span class="cl-kind">${evCount(pl.visits.length)}</span></a></li>`).join('\n    ')}
  </ul>
</section>` : '';

  const verseHtml = it.verse ? `
<blockquote class="verse"><span class="vtext">${esc(it.verse)}</span>${it.verseRef ? `<cite>${esc(it.verseRef)}</cite>` : ''}</blockquote>` : '';

  // שער הכניסה: שלושת המבטים, כל אחד נפתח כבר על הפריט הזה
  const key = `${it.kind}:${it.id}`;
  const gateOpts = [optTimeline(`?sel=${key}`), optAtlas(`?sel=${key}`)];
  // המקום שנפתח הוא התחנה הראשונה בזמן, לא הראשונה באינדקס
  const yearAt = (pl) => (pl.visits.find((v) => v.id === it.id) || {}).year ?? Infinity;
  const firstStop = visited.slice().sort((a, b) => yearAt(a) - yearAt(b))[0];
  if (firstStop) gateOpts.push(optPlaces(`?p=${encodeURIComponent(firstStop.id)}`));

  /* רצועת המפה: לכל פריט עם מסע. במחשב הכרטיס נפתח לשתי עמודות -
     הבחירה מימין והמפה משמאל - ולכן יש שני חיתוכים: רחב לפס העליון
     בטלפון, ומאונך לעמודה. התמונה עצמה היא קישור למסע הדורות. */
  const journeyPts = journeyStations(maps[it.id]);
  const hasMap = journeyPts.length >= 2;
  const mapHeroHtml = hasMap ? `<a class="hero" href="/atlas?sel=${key}">
<picture>
<source media="(min-width:860px)" srcset="/hero/${it.kind}/${it.id}-split.jpg" width="${HERO_SPLIT.w}" height="${HERO_SPLIT.h}"/>
<img src="/hero/${it.kind}/${it.id}.jpg" width="${HERO_SIZE.w}" height="${HERO_SIZE.h}" alt="${escAttr(`מפת המסע של ${it.name}`)}"/>
</picture>
<span class="hero-tag">🗺️ ${journeyPts.length} תחנות במסע · לחצו לצפייה ←</span>
</a>` : '';

  /* רצועת ציר-זמן: לכל פריט שבאמת אין לו מסע (66 פריטים - אירועים,
     ספרים, רקע עולמי, ודמויות בלי תחנות מתועדות), לא רק לפיילוט.
     ה-SVG וקטורי ונבנה כאן ישירות, בלי קובץ תמונה נפרד. */
  let sliverHeroHtml = '';
  if (!hasMap) {
    const pad = Math.max(35, Math.round((it.end - it.start) * 0.5));
    const yMin = it.start - pad, yMax = it.end + pad;
    const neighbors = sliverNeighbors(it, yMin, yMax);
    const ownColor = KIND_COLOR[it.kind] || '#8a7250';
    // פריט ארוך (כמו ספר תרי-עשר, 3100–3448) יכול לפתוח בתקופה אחת
    // ולהסתיים בתקופה אחרת לגמרי כמה מאות שנים אחר-כך - תיוג לפי
    // תחילתו בלבד היה מציג טווח שנים שנגמר הרבה לפני שהפריט נגמר
    const eraEnd = era ? periodAt(it.end) : null;
    const periodBit = !era ? '' : (eraEnd && eraEnd.id !== era.id
      ? `<div class="sliver-period">תקופה: <b>${esc(era.name)}</b> ועד <b>${esc(eraEnd.name)}</b></div>`
      : `<div class="sliver-period">תקופה: <b>${esc(era.name)}</b> (${era.start}–${era.end})</div>`);
    sliverHeroHtml = `<a class="hero sliver" href="/?sel=${key}">
${periodBit}
${sliverSvg({ name: it.name, start: it.start, end: it.end }, ownColor, neighbors, yMin, yMax)}
<span class="hero-tag">📜 על ציר הזמן · לחצו לצפייה ←</span>
</a>`;
  }

  const heroHtml = mapHeroHtml || sliverHeroHtml;

  // התוכן המלא של הדף - מה שגוגל מאנדקס - יושב מתחת לשער
  const article = `
<section id="more">
<h2>על ${esc(it.name)}</h2>
${rows.join('\n')}
<p class="desc">${esc(desc)}</p>
${verseHtml}
${srcHtml ? `<div class="src"><b>מקור:</b> ${srcHtml}</div>` : ''}
</section>
${visitedHtml}
${contempHtml}
${placeHtml}
<div class="ctas">
  <a class="cta" href="/?sel=${key}">📜 פתחו בציר הזמן ←</a>
  <a class="cta ghost" href="/atlas?sel=${key}">🗺️ צאו למסע הדורות ←</a>
</div>
${rel}`;

  const gateHtml = gate({
    chip: km.label, name: it.name, dates,
    lead: firstSentence(desc, 190),
    question: `איך תרצו לגלות את ${it.name}?`,
    opts: gateOpts,
    readLabel: `או קראו כאן על ${it.name}`,
    hero: heroHtml,
    split: !!heroHtml,
  });

  /* בדף הפיילוט הכרטיס תופס את המסך הראשון לבדו - בלי כותרת עליונה
     ובלי פירורי לחם מעליו - והגלילה חושפת את הטקסט המלא מתחתיו. */
  const body = heroHtml
    ? `<div class="screen">
${gateHtml}
</div>
<div class="below">${crumbsNav(crumbs)}
${article}
</div>`
    : `
${gateHtml}
${article}`;

  return shell({ title: `${it.name}: ${km.label} - ציר הזמן של עם ישראל`, description: metaDesc, canonical, jsonld, body,
    ogImage, crumbs, wide: !!heroHtml, bare: !!heroHtml, bodyClass: heroHtml ? 'bg-og' : '' });
}

// דף תקופה - מרכז את כל מי שחי/התרחש בה
function periodPage(p, i) {
  const list = itemsInPeriod(p);
  const groups = {};
  for (const it of list) (groups[KINDS[it.kind].group] ||= []).push(it);
  const prev = sortedPeriods[i - 1], next = sortedPeriods[i + 1];
  const metaDesc = truncate(`${p.name} (${p.start}–${p.end}) - כל הדמויות, האירועים וספרי התנ״ך של התקופה: ${list.slice(0, 6).map((x) => x.name).join(', ')}`, 155);
  const body = `
${gate({
    chip: 'תקופה', name: p.name, dates: formatRange(p.start, p.end, 'tradition'),
    lead: `${list.length} דמויות, אירועים וספרים מתוארכים לתקופה זו.`,
    question: `איך תרצו לגלות את ${p.name}?`,
    // ?era פותח את הציר גלול לתקופה ואת מפת המקומות מסוננת אליה,
    // ומסע הדורות נפתח על הפריט הראשון שבה
    opts: [
      optTimeline(`?era=${p.id}`),
      optAtlas(list.length ? `?sel=${list[0].kind}:${list[0].id}` : ''),
      optPlaces(`?era=${p.id}`),
    ],
    readLabel: 'או קראו כאן מי היה בתקופה',
  })}
<div class="idx" id="more">
${Object.entries(groups).map(([g, arr]) => `<h2>${esc(g)}</h2>
<ul>${arr.map((it) => `<li><a href="/p/${it.kind}/${it.id}">${esc(it.name)}</a></li>`).join('')}</ul>`).join('\n')}
</div>
<nav class="rel">
${prev ? `<a href="/p/period/${prev.id}">← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="/p/period/${next.id}">${esc(next.name)} →</a>` : '<span></span>'}
</nav>`;
  return shell({
    title: `${p.name} (${p.start}–${p.end}) - ציר הזמן של עם ישראל`,
    description: metaDesc,
    canonical: periodUrl(p),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: p.name,
      description: metaDesc,
      url: periodUrl(p),
      image: `${SITE}/og/period/${p.id}.jpg`,
      inLanguage: 'he',
      isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
    },
    body,
    ogImage: `${SITE}/og/period/${p.id}.jpg`,
    crumbs: [
      { name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
      { name: p.name },
    ],
  });
}

// דף אוסף - קבוצת דמויות שקשורות ברעיון אחד.
// כל חבר מוצג עם משפט פותח משלו ולא רק כשם: אחרת הדף הוא רשימת קישורים
// (~160 מילים) שגוגל מסווג כתוכן דק ואינו מאנדקס.
const firstSentence = (s = '', max = 165) => {
  const t = clean(s);
  const m = t.match(/^[^.!?]{25,}?[.!?]/);          // משפט שלם, אם הוא לא קצר מדי
  const out = m ? m[0] : t;
  return truncate(out, max);
};
function collectionPage(c) {
  const members = c.members.map((id) => items.find((x) => x.id === id)).filter(Boolean);
  const url = `${SITE}/p/collection/${c.id}`;
  const metaDesc = truncate(`${c.title} - ${c.subtitle}. ${members.map((m) => m.name).join(', ')}`, 155);
  const others = collections.filter((o) => o.id !== c.id);
  const span = members.length
    ? formatRange(Math.min(...members.map((m) => m.start)), Math.max(...members.map((m) => m.end)), 'tradition')
    : '';
  // התקופות שהאוסף פרושׂ עליהן - נותן הקשר כרונולוגי וקישור פנימי לדפי התקופה
  const eras = [...new Set(members.map((m) => periodOf(m)).filter(Boolean).map((p) => p.id))]
    .map((id) => sortedPeriods.find((p) => p.id === id));
  const body = `
${gate({
    chip: 'אוסף', name: `${c.icon} ${c.title}`,
    dates: `${c.subtitle} · ${members.length} דמויות${span ? ` · ${span}` : ''}`,
    lead: c.description,
    question: 'איך תרצו לגלות את האוסף?',
    // ?coll פותח את הציר עם כרטיס האוסף פרוש
    opts: [
      optTimeline(`?coll=${c.id}`),
      optAtlas(members.length ? `?sel=${members[0].kind}:${members[0].id}` : ''),
      optPlaces(),
    ],
    readLabel: 'או קראו כאן על הדמויות',
  })}
${eras.length ? `<div class="row"><b>תקופות:</b> ${eras.map((p) => `<a href="/p/period/${p.id}">${esc(p.name)}</a>`).join(' · ')}</div>` : ''}
<section class="related" id="more">
  <h2>הדמויות באוסף</h2>
  <p class="related-sub">לחצו על שם כדי לקרוא את הסיפור המלא, המקורות והמפה.</p>
  <ol class="mlist">
    ${members.map((m) => `<li>
      <a href="/p/${m.kind}/${m.id}"><b>${esc(m.name)}</b></a>
      <span class="dim">${esc(KINDS[m.kind].label)} · ${esc(formatRange(m.start, m.end, 'tradition'))}</span>
      <p>${esc(firstSentence(m.description))}</p>
    </li>`).join('\n    ')}
  </ol>
</section>
<a class="cta" href="/?coll=${c.id}">פתחו בציר הזמן האינטראקטיבי ←</a>
<section class="related">
  <h2>אוספים נוספים</h2>
  <ul class="chips">
    ${others.map((o) => `<li><a href="/p/collection/${o.id}"><span class="cl-name">${esc(o.icon)} ${esc(o.title)}</span><span class="cl-kind">${esc(o.subtitle)}</span></a></li>`).join('\n    ')}
  </ul>
</section>`;
  return shell({
    title: `${c.title}: ${c.subtitle} - ציר הזמן של עם ישראל`,
    description: metaDesc,
    canonical: url,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: c.title,
      description: c.description,
      url,
      inLanguage: 'he',
      isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
      hasPart: members.map((m) => ({ '@type': 'Person', name: m.name, url: urlOf(m) })),
    },
    body,
    crumbs: [
      { name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
      { name: 'אוספים', url: SITE + '/p/' },
      { name: c.title },
    ],
  });
}

/* דף מקום - הציר השלישי כדף נחיתה: לא "מי" ולא "מתי" אלא "איפה".
   התוכן הייחודי של הדף הוא הכרונולוגיה עצמה - מה קרה במקום הזה,
   לפי הסדר - ולכן גם למקום עם ביקור אחד יש כאן טקסט משלו ולא תבנית. */
const evCount = (n) => (n === 1 ? 'אירוע אחד' : `${n} אירועים`);
const placeUrl = (p) => `${SITE}/p/place/${encodeURIComponent(p.id)}`;
const placeHref = (p) => `/p/place/${encodeURIComponent(p.id)}`;
// מקומות בסביבה - קישור פנימי בין דפי המקומות. המרחק נמדד ביחידות
// המפה ואינו מתורגם לקילומטרים: ההיטל אינו שומר-מרחקים.
const nearbyOf = (p) => placesIndex
  .filter((o) => o.id !== p.id)
  .map((o) => ({ o, d: Math.hypot(o.x - p.x, o.y - p.y) }))
  .sort((a, b) => a.d - b.d || b.o.visits.length - a.o.visits.length)
  .slice(0, 6).map((x) => x.o);

function placePage(p) {
  const first = p.visits[0], last = p.visits[p.visits.length - 1];
  const names = [...new Set(p.visits.map((v) => v.name))];
  const span = p.from === p.to ? `שנת ${p.from} לבריאה` : `${p.from}–${p.to} לבריאה`;
  const intro = p.visits.length === 1
    ? `${p.name} מופיע בסיפורו של ${first.name}${first.label ? ` - ${first.label}` : ''}.`
    : `${p.name} מופיע ב-${p.visits.length} תחנות במסעות הדמויות, מ${first.name} (${first.year}) ועד ${last.name} (${last.year}). `
      + `עברו כאן ${names.length === 1 ? first.name : names.slice(0, 6).join(', ')}${names.length > 6 ? ' ועוד' : ''}.`;
  /* מקום עם ביקור אחד או שניים הוא דף דק: התוכן הייחודי שלו הוא כמה
     שורות. במקרים האלה מוסיפים הקשר אמיתי - משפט פותח על כל מי שעבר
     כאן, ושאר תחנות המסע שלו - במקום להשאיר שלד של קישורים. */
  const thin = p.visits.length <= 3;
  const whoHtml = thin ? p.visits.map((v) => {
    const it = byId(v.id);
    return it && it.description
      ? `<p class="desc">${esc(`${it.name}: ${firstSentence(it.description, 210)}`)}</p>` : '';
  }).join('\n') : '';
  const restOfJourney = thin
    ? placesIndex.filter((o) => o.id !== p.id && o.visits.some((v) => v.id === first.id))
    : [];
  const metaDesc = truncate(`${p.name} - ${evCount(p.visits.length)} בין ${p.from} ל-${p.to} לבריאה. ${clean(first.desc || intro)}`, 155);
  // התקופות שהמקום נוכח בהן - הקשר כרונולוגי וקישור פנימי לדפי התקופה
  const eras = sortedPeriods.filter((e) => p.visits.some((v) => v.year >= e.start && v.year < e.end));
  const nearby = nearbyOf(p);
  const crumbs = [
    { name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
    { name: 'מפת המקומות', url: `${SITE}/places` },
    { name: p.name },
  ];

  /* רצועת המפה: לכל מקום, תמיד - יש לו x/y ולכן תמיד אפשר להראות
     אותו על המפה, בשונה מפריט שיכול בכלל לא להיות בעל מסע. אותה
     נקודה מודגשת שנצרבה בבנייה (writePlaceHero), עם מקומות שכנים
     כנקודות עמומות ברקע. */
  const heroHtml = `<a class="hero" href="/places?p=${encodeURIComponent(p.id)}">
<picture>
<source media="(min-width:860px)" srcset="/hero/place/${encodeURIComponent(p.id)}-split.jpg" width="${HERO_SPLIT.w}" height="${HERO_SPLIT.h}"/>
<img src="/hero/place/${encodeURIComponent(p.id)}.jpg" width="${HERO_SIZE.w}" height="${HERO_SIZE.h}" alt="${escAttr(`${p.name} על המפה`)}"/>
</picture>
<span class="hero-tag">📍 ${evCount(p.visits.length)} · לחצו לצפייה ←</span>
</a>`;

  // התוכן המלא של הדף - מה שגוגל מאנדקס - יושב מתחת לשער
  const article = `
${p.aka.length ? `<div class="row"><b>נקרא גם:</b> ${p.aka.map(esc).join(' · ')}</div>` : ''}
${eras.length ? `<div class="row"><b>תקופות:</b> ${eras.map((e) => `<a href="/p/period/${e.id}">${esc(e.name)}</a>`).join(' · ')}</div>` : ''}
<section class="related" id="more">
  <h2>מה קרה כאן, לפי הסדר</h2>
  <p class="related-sub">כל מי שעבר ב${esc(p.name)} על ציר הזמן:</p>
  <ol class="mlist">
    ${p.visits.map((v) => `<li>
      <a href="/p/${v.kind}/${v.id}"><b>${esc(v.name)}</b></a>
      <span class="dim">${esc(KINDS[v.kind] ? KINDS[v.kind].label : '')} · שנת ${v.year}</span>
      ${v.label ? `<p><b>${esc(v.label)}</b></p>` : ''}
      ${v.desc ? `<p>${esc(clean(v.desc))}</p>` : ''}
    </li>`).join('\n    ')}
  </ol>
</section>
${whoHtml}
${restOfJourney.length ? `<section class="related">
  <h2>שאר המסע של ${esc(first.name)}</h2>
  <p class="related-sub">התחנות הנוספות שבהן ${esc(first.name)} מופיע:</p>
  <ul class="chips">
    ${restOfJourney.map((o) => `<li><a href="${placeHref(o)}"><span class="cl-name">${esc(o.name)}</span><span class="cl-kind">${evCount(o.visits.length)}</span></a></li>`).join('\n    ')}
  </ul>
</section>` : ''}
<section class="related">
  <h2>מקומות בסביבה</h2>
  <ul class="chips">
    ${nearby.map((o) => `<li><a href="${placeHref(o)}"><span class="cl-name">${esc(o.name)}</span><span class="cl-kind">${evCount(o.visits.length)}</span></a></li>`).join('\n    ')}
  </ul>
</section>`;

  const gateHtml = gate({
    chip: 'מקום', name: p.name, dates: `${evCount(p.visits.length)} · ${span}`,
    lead: intro,
    question: `איך תרצו לגלות את ${p.name}?`,
    opts: [
      optPlaces(`?p=${encodeURIComponent(p.id)}`),
      optAtlas(`?sel=${first.kind}:${first.id}`),
      optTimeline(`?sel=${first.kind}:${first.id}`),
    ],
    readLabel: 'או קראו כאן מה קרה במקום',
    hero: heroHtml,
    split: true,
  });

  // הכרטיס תופס את המסך הראשון לבדו, בדיוק כמו דפי הדמות/אירוע
  const body = `<div class="screen">
${gateHtml}
</div>
<div class="below">${crumbsNav(crumbs)}
${article}
</div>`;

  return shell({
    title: `${p.name}: מה קרה כאן - ציר הזמן של עם ישראל`,
    description: metaDesc,
    canonical: placeUrl(p),
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: p.name,
      description: metaDesc,
      url: placeUrl(p),
      inLanguage: 'he',
      isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
      about: { '@type': 'Place', name: p.name, alternateName: p.aka },
    },
    body,
    ogImage: `${SITE}/og/place/${encodeURIComponent(p.id)}.jpg`,
    // המבט הראשי של דף-מקום הוא מפת המקומות - היא זו שנטענת מראש
    prefetch: 'places',
    crumbs,
    wide: true, bare: true, bodyClass: 'bg-og',
  });
}

// ---- כתיבה ----
let count = 0;
for (const it of items) {
  const dir = join(DIST, 'p', it.kind, it.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), itemPage(it));
  writeCard(DIST, join('og', it.kind, `${it.id}.jpg`), {
    name: it.name,
    kindLabel: KINDS[it.kind].label,
    dates: formatRange(it.start, it.end, 'tradition'),
  });
  {
    const pts = journeyStations(maps[it.id]);
    if (pts.length >= 2) {
      writeHero(DIST, join('hero', it.kind, `${it.id}.jpg`), pts, HERO_SIZE);
      writeHero(DIST, join('hero', it.kind, `${it.id}-split.jpg`), pts, HERO_SPLIT);
    }
  }
  count++;
}
sortedPeriods.forEach((p, i) => {
  const dir = join(DIST, 'p', 'period', p.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), periodPage(p, i));
  writeCard(DIST, join('og', 'period', `${p.id}.jpg`), {
    name: p.name,
    kindLabel: 'תקופה',
    dates: formatRange(p.start, p.end, 'tradition'),
  });
});
for (const p of placesIndex) {
  const dir = join(DIST, 'p', 'place', p.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), placePage(p));
  writeCard(DIST, join('og', 'place', `${p.id}.jpg`), {
    name: p.name,
    kindLabel: 'מקום',
    dates: p.from === p.to ? `שנת ${p.from}` : `${p.from}–${p.to} לבריאה`,
  });
  writePlaceHero(DIST, join('hero', 'place', `${p.id}.jpg`), p, nearbyOf(p), HERO_SIZE);
  writePlaceHero(DIST, join('hero', 'place', `${p.id}-split.jpg`), p, nearbyOf(p), HERO_SPLIT);
}
for (const c of collections) {
  const dir = join(DIST, 'p', 'collection', c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), collectionPage(c));
  writeCard(DIST, join('og', 'collection', `${c.id}.jpg`), {
    name: c.title, kindLabel: 'אוסף', dates: c.subtitle,
  });
}

// דף אינדקס /p/
const groups = {};
for (const it of items) {
  const g = KINDS[it.kind].group;
  (groups[g] ||= []).push(it);
}
const idxBody = `${gate({
  chip: 'מפת האתר', name: 'כל הדמויות והאירועים',
  dates: `${items.length} דמויות, אירועים וספרים · ${sortedPeriods.length} תקופות · ${placesIndex.length} מקומות`,
  lead: 'שלושה מבטים על אותו סיפור: הציר לפי הזמן, המפה לפי המסע, והמפה לפי המקום.',
  question: 'איך תרצו להתחיל?',
  opts: [optTimeline(), optAtlas(), optPlaces()],
  readLabel: 'או עיינו כאן ברשימה המלאה',
})}
<div class="idx" id="more">
<h2>תקופות</h2>
<ul>${sortedPeriods.map((p) => `<li><a href="/p/period/${p.id}">${esc(p.name)}</a></li>`).join('')}</ul>
<h2>אוספים</h2>
<ul>${collections.map((c) => `<li><a href="/p/collection/${c.id}">${esc(c.icon)} ${esc(c.title)}</a></li>`).join('')}</ul>
<h2>מקומות</h2>
<ul>${placesIndex.map((p) => `<li><a href="${placeHref(p)}">${esc(p.name)}</a></li>`).join('')}</ul>
${Object.entries(groups).map(([g, list]) => `<h2>${esc(g)}</h2>
<ul>${list.map((it) => `<li><a href="/p/${it.kind}/${it.id}">${esc(it.name)}</a></li>`).join('')}</ul>`).join('\n')}
</div>`;
mkdirSync(join(DIST, 'p'), { recursive: true });
writeFileSync(join(DIST, 'p', 'index.html'), shell({
  title: 'מפת האתר: כל הדמויות והאירועים - ציר הזמן של עם ישראל',
  description: 'רשימת כל הדמויות, האירועים וספרי התנ״ך שעל ציר הזמן של עם ישראל - מהאבות ועד חורבן בית שני.',
  canonical: `${SITE}/p`,
  jsonld: null,
  body: idxBody,
}));

// תמונת שיתוף למבט המסע (/atlas), שאינו נבנה כדף-נחיתה אלא כקובץ סטטי
writeCard(DIST, join('og', 'atlas.jpg'), {
  name: 'מסע הדורות',
  kindLabel: 'המפה והסיפור',
  dates: 'מהאבות ועד חורבן בית שני',
});

// sitemap.xml
const urls = [
  `${SITE}/`, `${SITE}/atlas`, `${SITE}/places`, `${SITE}/p`,
  ...sortedPeriods.map(periodUrl),
  ...collections.map((c) => `${SITE}/p/collection/${c.id}`),
  ...placesIndex.map(placeUrl),
  ...items.map(urlOf),
];
const lastmod = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap);

// robots.txt
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// הזרקת JSON-LD של האתר + קישור זחילה ל-index.html הראשי
const indexPath = join(DIST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
const siteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'ציר הזמן של עם ישראל',
  url: SITE + '/',
  description: 'ציר זמן אינטראקטיבי של תולדות עם ישראל - מהאבות ועד חורבן בית שני.',
  inLanguage: 'he',
};
if (!html.includes('application/ld+json')) {
  html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(siteLd)}</script>\n</head>`);
}
if (!html.includes('id="crawl-index"')) {
  html = html.replace('</body>', `<noscript><nav id="crawl-index"><a href="/p">מפת האתר - כל הדמויות והאירועים</a></nav></noscript>\n</body>`);
}
writeFileSync(indexPath, html);

// מבט המסע (/atlas) נבנה כולו ב-JavaScript מתוך atlas-data.json. מזריקים לו
// JSON-LD ותוכן noscript עם כל הדמויות, כך שגם זחלן שאינו מריץ JS רואה על מה
// הדף מדבר ומקבל נתיב לכל 158 דפי הנחיתה.
const atlasPath = join(DIST, 'atlas.html');
let atlasHtml = readFileSync(atlasPath, 'utf8');
const atlasLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'מסע הדורות',
  url: `${SITE}/atlas`,
  description: 'מסע לאורך תולדות עם ישראל - כל דמות עם סיפורה המלא ומפת מסעותיה בארץ ישראל.',
  inLanguage: 'he',
  isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
};
if (!atlasHtml.includes('application/ld+json')) {
  atlasHtml = atlasHtml.replace('</head>', `<script type="application/ld+json">${JSON.stringify(atlasLd)}</script>\n</head>`);
}
if (!atlasHtml.includes('id="crawl-atlas"')) {
  const byPeriod = sortedPeriods.map((p) => `<h2>${esc(p.name)} (${esc(formatRange(p.start, p.end, 'tradition'))})</h2>
<ul>${itemsInPeriod(p).map((it) => `<li><a href="/p/${it.kind}/${it.id}">${esc(it.name)}</a></li>`).join('')}</ul>`).join('\n');
  atlasHtml = atlasHtml.replace('</body>', `<noscript><nav id="crawl-atlas">
<h1>מסע הדורות - תולדות עם ישראל מהאבות ועד חורבן בית שני</h1>
<p>המסע האינטראקטיבי דורש JavaScript. עד אז, הנה כל הדמויות והאירועים לפי תקופה,
כל אחד עם סיפורו המלא: <a href="/p">מפת האתר</a> · <a href="/">ציר הזמן</a>.</p>
${byPeriod}
</nav></noscript>\n</body>`);
}
writeFileSync(atlasPath, atlasHtml);

// מפת המקומות (/places) נבנית אף היא ב-JavaScript מתוך places.json. אותו
// טיפול: JSON-LD, ותוכן noscript שמפרט את המקומות העשירים ואת מי שעבר בהם -
// כך יש לזחלן גם על מה לדבר וגם נתיב לדפי הנחיתה של הדמויות.
const placesPath = join(DIST, 'places.html');
let placesHtml = readFileSync(placesPath, 'utf8');
const placesLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'מפת המקומות',
  url: `${SITE}/places`,
  description: 'לפי מקום ולא לפי זמן: מי עבר בכל מקום בארץ ישראל ומה קרה שם, מאברהם ועד שיבת ציון.',
  inLanguage: 'he',
  isPartOf: { '@type': 'WebSite', name: 'ציר הזמן של עם ישראל', url: SITE + '/' },
};
if (!placesHtml.includes('application/ld+json')) {
  placesHtml = placesHtml.replace('</head>', `<script type="application/ld+json">${JSON.stringify(placesLd)}</script>\n</head>`);
}
if (!placesHtml.includes('id="crawl-places"')) {
  const rich = placesIndex.filter((p) => p.visits.length >= 3);
  const body = rich.map((p) => `<h2>${esc(p.name)} (${p.visits.length} ביקורים)</h2>
<ul>${p.visits.map((v) => `<li><a href="/p/${v.kind}/${v.id}">${esc(v.name)}</a>${v.label ? ` - ${esc(v.label)}` : ''}</li>`).join('')}</ul>`).join('\n');
  placesHtml = placesHtml.replace('</body>', `<noscript><nav id="crawl-places">
<h1>מפת המקומות - איפה קרתה ההיסטוריה של עם ישראל</h1>
<p>המפה האינטראקטיבית דורשת JavaScript. עד אז, הנה המקומות המרכזיים ומי עבר בכל אחד מהם:
<a href="/p">מפת האתר</a> · <a href="/">ציר הזמן</a> · <a href="/atlas">מסע הדורות</a>.</p>
${body}
</nav></noscript>\n</body>`);
}
writeFileSync(placesPath, placesHtml);

console.log(`prerender: ${count} item pages + ${sortedPeriods.length} period pages + index + sitemap (${urls.length} urls) + robots`);
