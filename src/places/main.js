/* מפת הארץ - הציר השלישי של האתר.
   ציר הזמן שואל "מתי", מסע הדורות שואל "מי", וכאן שואלים "איפה":
   אותם 275 ביקורים, מסודרים לפי המקום ולא לפי הדמות. הנתונים מגיעים
   מ-src/data/places.json שנוצר בידי scripts/places-data.mjs. */
import { MAP_SRC, MAP_SIZE } from '../utils/mapProject.js';
import PLACES from '../data/places.json';
import PERIODS from '../data/periods.json';
import { shareLink } from '../lib/share.js';
import { startTrail, markOnce, mark } from '../lib/trail.js';
import { nearest, locateOnMap, pxPerKm, fmtKm, getPosition, MAX_KM } from './nearby.js';
import { mountSiteMenu } from '../components/siteMenu.js';

startTrail();
/* תפריט "עוד באתר" המשותף. במסך הזה אין חלוניות משלו, ולכן כל פריט הוא
   קישור שפותח אותו בציר הזמן (או במשחק). */
mountSiteMenu(document.getElementById('menuHost'));

const $ = (s) => document.querySelector(s);
const KIND_COLOR = { leader:'var(--leader)', judge:'var(--judge)', united:'var(--united)', judah:'var(--judah)',
  israel:'var(--israel)', prophet:'var(--prophet)', book:'var(--book)', event:'var(--event)', world:'var(--world)' };
const KIND_LABEL = { leader:'מנהיג', judge:'שופט', united:'מלך', judah:'מלך יהודה', israel:'מלך ישראל',
  prophet:'נביא', book:'ספר', event:'אירוע', world:'רקע עולמי' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

const TOTAL_VISITS = PLACES.reduce((s, p) => s + p.visits.length, 0);
const MAX_VISITS = Math.max(...PLACES.map((p) => p.visits.length));
// רק תקופות שבאמת יש בהן ביקורים - השאר היו נראות ככפתורים מתים
const inEra = (p, era) => p.visits.some((v) => v.year >= era.start && v.year < era.end);
const ERAS = PERIODS.filter((e) => PLACES.some((p) => inEra(p, e)));

// שנת הביקור היא שנת הפתיחה של הדמות, ולכן ה"תקופה" כאן היא תקופתה של
// הדמות המבקרת. זה מה שכתוב גם בתווית שמעל הכפתורים, כדי לא להטעות.
let era = null, sel = null, query = '', playT = null;
/* "איפה אני": null, או { state: 'loading' | 'ok' | 'outside' | 'error', ... }.
   נשמר בזיכרון הדף בלבד - לא ב-localStorage ולא בכתובת. */
let near = null;

// ==================== מפה ====================
const RAD = (n) => 5 + 3.6 * Math.sqrt(n - 1);

function drawMap() {
  const marks = [...PLACES]
    // הגדולים נצבעים ראשונים ולכן יושבים מתחת: כך נקודה קטנה וסמוכה
    // (בית לחם ליד ירושלים) נשארת גלויה וניתנת ללחיצה
    .sort((a, b) => b.visits.length - a.visits.length)
    .map((p) => {
      const r = RAD(p.visits.length);
      return `<g class="pm" data-id="${esc(p.id)}" data-r="${r.toFixed(1)}" data-y="${p.y}"
        data-v="${p.visits.length}" role="button" tabindex="0"
        aria-label="${esc(p.name)} - ${p.visits.length} ביקורים">
        <title>${esc(p.name)} · ${p.visits.length} ביקורים</title>
        <circle class="dot" cx="${p.x}" cy="${p.y}" r="${r.toFixed(1)}"/>
        <circle class="hit" cx="${p.x}" cy="${p.y}" r="${(r * 1.25).toFixed(1)}"/></g>`;
    }).join('');
  /* השמות יושבים בשכבה נפרדת מעל כל הסמנים. כשהם היו בתוך קבוצת הסמן,
     סמן זעיר שמצויר אחריה כיסה אותם, ולחיצה על "ירושלים" בחרה מקום אחר. */
  const labels = PLACES.map((p) => {
    const r = RAD(p.visits.length);
    return `<text class="lb" data-id="${esc(p.id)}" data-v="${p.visits.length}" data-y="${p.y}"
      x="${p.x}" y="${(p.y - r - 7).toFixed(1)}" text-anchor="middle" font-size="21">${esc(p.name)}</text>`;
  }).join('');
  $('#map').innerHTML =
    `<image href="${MAP_SRC}" x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}"/>
     ${marks}<g id="labels">${labels}</g><g id="me" aria-hidden="true"></g>`;
  $('#map').querySelectorAll('.pm').forEach((g) => {
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.dataset.id); }
    });
  });
  /* בחירה גאומטרית ולא לפי סדר הציור. הסמנים הגדולים מצוירים ראשונים
     (אחרת שכנים קטנים היו נבלעים תחתם), ולכן בבדיקת הפגיעה של ה-DOM
     סמן זעיר שמצויר אחרון "גנב" את הלחיצה מירושלים ואף כיסה את שמה.
     כאן נבחר הסמן שהלחיצה עמוקה בתוכו ביותר - מרחק חלקי רדיוס. */
  $('#map').addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('lb')) return select(e.target.dataset.id);
    const svg = $('#map'), m = svg.getScreenCTM();
    if (!m) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    const k = Math.max(0.4, cam.h / BASE_H);
    let best = null, bestScore = Infinity;
    for (const g of svg.querySelectorAll('.pm:not(.off)')) {
      const c = g.querySelector('.dot');
      const r = Math.max(+g.dataset.r * k * 1.25, 9 * k);
      const s = Math.hypot(p.x - +c.getAttribute('cx'), p.y - +c.getAttribute('cy')) / r;
      if (s <= 1 && s < bestScore) { best = g; bestScore = s; }
    }
    if (best) select(best.dataset.id);
  });
}

/* ---------- מצלמה ----------
   ה-viewBox הוא המצלמה. הוא מחושב תמיד מיחס הצדדים הנמדד של הקופסה,
   ולכן התיבה המבוקשת נכנסת בשלמותה ושום מקום אינו נגזר בקצה. */
let cam = { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE }, camAF = null, camTO = null, wrapAR = 1;
const BASE_H = 1300;                    // גובה מבט הבסיס, לכיול גודל הסמנים
const bboxOf = (list) => ({
  x0: Math.min(...list.map((p) => p.x)), x1: Math.max(...list.map((p) => p.x)),
  y0: Math.min(...list.map((p) => p.y)), y1: Math.max(...list.map((p) => p.y)),
});
// תקרת זום: מתחת ל-300 יחידות תמונת המפה (1254 פיקסלים) נמתחת ומטשטשת,
// ותקופה עם מקום יחיד הייתה קופצת לזום של פי חמישה
const MIN_SPAN = 300;
function fitBox(b, pad = 60) {
  const bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  let h = Math.max(bw, bh * wrapAR) / wrapAR;
  if (h < MIN_SPAN) h = MIN_SPAN;
  // תקרה: התיבה הגדולה ביותר שעדיין נמצאת כולה בתוך התמונה. בלעדיה
  // "מבט מלא" ביקש 1335 יחידות על תמונה של 1254, והמסגרת התמלאה
  // ברקע ריק משני צדי המפה.
  const maxH = wrapAR >= 1 ? MAP_SIZE / wrapAR : MAP_SIZE;
  if (h > maxH) h = maxH;
  const w = h * wrapAR;
  const clamp = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  return { x: clamp(cx - w / 2, 0, MAP_SIZE - w), y: clamp(cy - h / 2, 0, MAP_SIZE - h), w, h };
}
/* מבט הבסיס אינו "כל המקומות": חרן, בבל, נינוה וסיני מותחים את מרחב
   הנתונים על כמעט כל המפה, ותיבה שמכילה אותם משאירה את ארץ ישראל -
   שבה 80% מהביקורים - זעירה. לכן הבסיס הוא תיבת האחוזונים 10-90 של
   מיקומי הביקורים, והחריגים נגישים בבחירת מקום, בתקופה, או ב"מבט מלא". */
const DENSE = (() => {
  const xs = [], ys = [];
  for (const p of PLACES) for (let i = 0; i < p.visits.length; i++) { xs.push(p.x); ys.push(p.y); }
  const q = (a, f) => { const s = [...a].sort((m, n) => m - n); return s[Math.floor((s.length - 1) * f)]; };
  return { x0: q(xs, .1), x1: q(xs, .9), y0: q(ys, .1), y1: q(ys, .9) };
})();
const baseCam = () => fitBox(DENSE, 90);
const fullCam = () => fitBox(bboxOf(PLACES), 60);

// התיבה שהמצלמה אמורה להראות: מקום נבחר, אחרת התקופה, אחרת מבט הבסיס
function camTarget() {
  if (sel) {
    const p = PLACES.find((x) => x.id === sel);
    if (p) return fitBox({ x0: p.x, x1: p.x, y0: p.y, y1: p.y }, 165);
  }
  // הגולש ושלושת המקומות הקרובים אליו - כך רואים גם איפה אתה וגם מה סביבך
  if (near && near.state === 'ok') {
    const pts = [near.pt, ...near.list.slice(0, 3).map((n) => n.p)];
    return fitBox(bboxOf(pts), 110);
  }
  if (era) {
    const list = PLACES.filter((p) => inEra(p, era));
    if (list.length) return fitBox(bboxOf(list), 80);
  }
  return baseCam();
}
const lerp = (a, b, k) => a + (b - a) * k;
let camFree = false;                      // המשתמש ביקש מבט מלא ידנית
function applyCam(v) {
  cam = v;
  $('#map').setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  paintZoom();
  const b = baseCam();
  $('#reset').classList.toggle('show', Math.abs(v.w - b.w) > 20 || Math.abs(v.x - b.x) > 20 || Math.abs(v.y - b.y) > 20);
}
function setCam(to, animate = true) {
  cancelAnimationFrame(camAF); clearTimeout(camTO);
  if (!animate) return applyCam(to);
  const from = { ...cam }, t0 = performance.now(), D = 420;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / D);
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    applyCam({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), w: lerp(from.w, to.w, e), h: lerp(from.h, to.h, e) });
    if (k < 1) camAF = requestAnimationFrame(tick);
  };
  camAF = requestAnimationFrame(tick);
  // רשת ביטחון: בלשונית שאינה מציירת פריימים ה-rAF לא רץ, והמצלמה
  // הייתה נתקעת באמצע. אחרי משך ההנפשה קובעים את היעד בכל מקרה.
  camTO = setTimeout(() => { cancelAnimationFrame(camAF); applyCam(to); }, D + 120);
}
const moveCam = (animate = true) => {
  camFree = false; camManual = false; setCam(camTarget(), animate);
  if (mode === 'modern') modernFocus();
};

/* ---------- גרירה וזום ידניים ----------
   גולש העיר שאי אפשר לזוז על המפה: צביטה הגדילה את כל הדף ולא את המפה.
   עכשיו המפה מטפלת במגע בעצמה (touch-action:none): אצבע אחת גוררת, שתיים
   מזיזות ומגדילות, גלגלת מגדילה במחשב, ו-+/− לכל מי שלא נוח לו במחוות.
   המצלמה היא אותו viewBox, ולכן הסמנים והשמות ממשיכים להתכייל כרגיל. */
let camManual = false;                    // המצלמה הוזזה ביד - שינוי גודל שומר עליה
const MIN_ZOOM = 150;                     // מתחת לזה תמונת המפה מטושטשת מדי
const maxCamH = () => (wrapAR >= 1 ? MAP_SIZE / wrapAR : MAP_SIZE);
function clampCam(x, y, h) {
  h = Math.min(Math.max(h, MIN_ZOOM), maxCamH());
  const w = h * wrapAR;
  const c = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  return { x: c(x, 0, MAP_SIZE - w), y: c(y, 0, MAP_SIZE - h), w, h };
}
// יחידות מפה לפיקסל מסך, ונקודת המפה שמתחת לנקודת מסך
const upp = () => cam.w / $('#map').getBoundingClientRect().width;
function toMap(clientX, clientY) {
  const r = $('#map').getBoundingClientRect();
  return { x: cam.x + (clientX - r.left) * upp(), y: cam.y + (clientY - r.top) * upp() };
}
// זום סביב נקודה: הנקודה שמתחת לאצבע או לעכבר נשארת במקומה
function zoomAt(mx, my, f, animate = false) {
  const h = Math.min(Math.max(cam.h * f, MIN_ZOOM), maxCamH());
  const k = h / cam.h;
  camManual = true; camFree = false;
  setCam(clampCam(mx - (mx - cam.x) * k, my - (my - cam.y) * k, h), animate);
}

const ptrs = new Map();
let gesture = null, dragged = false;
function gestureStart() {
  const pts = [...ptrs.values()];
  // עותק ולא הפניה: pts[0] הוא האובייקט החי שמתעדכן בכל תזוזה, והפניה
  // אליו אפסה את מרחק הגרירה - המפה לא זזה באצבע אחת
  const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { x: pts[0].x, y: pts[0].y };
  const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  gesture = { cam: { ...cam }, mid, dist, anchor: toMap(mid.x, mid.y), upp: upp(), n: pts.length };
}
function onPtrDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  cancelAnimationFrame(camAF); clearTimeout(camTO);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (ptrs.size === 1) dragged = false;
  gestureStart();
}
function onPtrMove(e) {
  const p = ptrs.get(e.pointerId);
  if (!p || !gesture) return;
  p.x = e.clientX; p.y = e.clientY;
  // סף של 6 פיקסלים: לחיצה רועדת על סמן היא עדיין לחיצה, לא גרירה
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) dragged = true;
  if (!dragged) return;
  const pts = [...ptrs.values()];
  if (pts.length !== gesture.n) return gestureStart();
  const g = gesture, r = $('#map').getBoundingClientRect();
  if (pts.length === 1) {
    camManual = true; camFree = false;
    applyCam(clampCam(g.cam.x - (pts[0].x - g.mid.x) * g.upp, g.cam.y - (pts[0].y - g.mid.y) * g.upp, g.cam.h));
  } else {
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const h = Math.min(Math.max(g.cam.h * (g.dist / dist), MIN_ZOOM), maxCamH());
    const u = g.upp * (h / g.cam.h);
    camManual = true; camFree = false;
    applyCam(clampCam(g.anchor.x - (mid.x - r.left) * u, g.anchor.y - (mid.y - r.top) * u, h));
  }
}
function onPtrUp(e) {
  if (!ptrs.delete(e.pointerId)) return;
  if (ptrs.size) gestureStart(); else gesture = null;
}

/* גודל הסמנים והתוויות נקבע ביחידות ה-viewBox, ולכן זום-אין היה מנפח
   אותם. הכיול ההפוך משאיר אותם בערך באותו גודל על המסך, ותוויות
   נוספות נחשפות ככל שמתקרבים - במבט הבסיס 14 שמות, בזום מלא כולם. */
function paintZoom() {
  const k = Math.max(0.4, cam.h / BASE_H);
  const need = k > 0.75 ? 4 : k > 0.5 ? 3 : k > 0.3 ? 2 : 1;
  $('#map').querySelectorAll('.pm').forEach((g) => {
    const on = g.classList.contains('on');
    const r = +g.dataset.r * k * (on ? 1.3 : 1);
    g.querySelector('.dot').setAttribute('r', r.toFixed(1));
    // הגדלה מתונה בלבד: אזור פגיעה נדיב של סמן קטן היה מכסה את שכנו
    g.querySelector('.hit').setAttribute('r', Math.max(r * 1.25, 9 * k).toFixed(1));
  });
  paintMe(k);
  // שמות המקומות שברשימת "קרוב אליך" גלויים תמיד - אחרת "יפו · 4.9 ק״מ"
  // הופיע ברשימה בלי שם ליד הנקודה שלו במפה
  const nearIds = new Set(near && near.state === 'ok' ? near.list.map((n) => n.p.id) : []);
  $('#map').querySelectorAll('.lb').forEach((t) => {
    const on = t.classList.contains('on');
    const r = RAD(+t.dataset.v) * k * (on ? 1.3 : 1);
    t.setAttribute('font-size', ((on ? 24 : 21) * k).toFixed(1));
    t.setAttribute('y', (+t.dataset.y - r - 8 * k).toFixed(1));
    t.style.display = (+t.dataset.v >= need || on || nearIds.has(t.dataset.id)) ? '' : 'none';
  });
}

/* סיכת "אתה כאן" ועיגול הדיוק. העיגול בק"מ אמיתיים (ביחידות המפה), והסיכה
   נשמרת בגודל קבוע על המסך כמו שאר הסמנים. היא סיכה אדומה ולא עיגול:
   נקודה כחולה בין עשרות נקודות כחולות-כהות לא בלטה (הערת בעל האתר).
   החוד יושב בדיוק על המיקום, והשכבה מעל השמות - שום שם לא מסתיר אותה. */
function paintMe(k = Math.max(0.4, cam.h / BASE_H)) {
  const g = $('#me'); if (!g) return;
  if (!near || near.state !== 'ok') { g.innerHTML = ''; return; }
  const { pt, acc, lat, lon } = near;
  // תקרה של 25 ק"מ: עיגול בגודל חצי הארץ (מחשב בלי GPS) רק מסתיר את המפה
  const accR = Math.min(acc / 1000, 25) * pxPerKm(lat, lon);
  const s = (1.15 * k).toFixed(3);
  g.innerHTML = `<circle class="me-acc" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${Math.max(accR, 12 * k).toFixed(1)}"/>
    <g transform="translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${s})">
      <ellipse class="me-shadow" cx="0" cy="0" rx="9" ry="3.5"/>
      <path class="me-pin" d="M0,0 C-4,-10 -15,-18 -15,-29 A15,15 0 1 1 15,-29 C15,-18 4,-10 0,0 Z"/>
      <circle class="me-core" cx="0" cy="-29" r="6"/>
    </g>`;
}

function paintMarks() {
  const shown = new Set(filtered().map((p) => p.id));
  let topPin = null, topLabel = null;
  $('#map').querySelectorAll('.pm, .lb').forEach((el) => {
    el.classList.toggle('off', !shown.has(el.dataset.id));
    el.classList.toggle('on', el.dataset.id === sel);
    if (el.dataset.id === sel) { if (el.classList.contains('pm')) topPin = el; else topLabel = el; }
  });
  // הנבחר עולה לסוף סדר הציור בשכבה שלו: הסמנים הגדולים מצוירים ראשונים
  // ולכן יושבים מתחת, וירושלים הנבחרת הייתה מוסתרת חלקית תחת שכנותיה
  if (topPin) topPin.parentNode.insertBefore(topPin, $('#labels'));
  if (topLabel) topLabel.parentNode.appendChild(topLabel);
  paintZoom();
  modern?.sync(modernState());
}

// ==================== סינון ורשימה ====================
const norm = (s) => (s || '').replace(/[״"׳'־]/g, '').trim();
// התאמה בתחילת מילה בלבד, כמו בחיפוש של מסע הדורות: תת-מחרוזת חופשית
// הייתה מחזירה את "אשדוד" עבור "דוד".
const hits = (hay, q) => {
  const h = norm(hay);
  if (!h) return false;
  // ו' החיבור נבלעת: 'גת ואשדוד' לא נמצא בחיפוש 'אשדוד', וכך גם פנואל,
  // העי, חורב, מצפה והגליל - תשעה מקומות אמיתיים שלא ניתן היה לאתר.
  // רק ו' ולא שאר התחיליות: ב-מ-ה היו מחזירות את 'מרים' עבור 'רים'.
  return new RegExp('(^|[\\s\\-–(,./])ו?' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h);
};
function filtered() {
  const q = norm(query);
  return PLACES.filter((p) => {
    if (era && !inEra(p, era)) return false;
    if (q && !hits(p.name, q) && !p.aka.some((a) => hits(a, q))
        && !p.visits.some((v) => hits(v.name, q))) return false;
    return true;
  });
}

function renderEras() {
  $('#eras').innerHTML =
    `<button class="echip${era ? '' : ' on'}" data-e="">הכל</button>` +
    ERAS.map((e) => `<button class="echip${era && era.id === e.id ? ' on' : ''}" data-e="${e.id}">${esc(e.name)}</button>`).join('') +
    `<button class="echip play" id="playBtn">▶ הרצת תקופות</button>`;
  $('#eras').querySelectorAll('.echip[data-e]').forEach((b) => b.addEventListener('click', () => {
    stopPlay();
    setEra(b.dataset.e ? ERAS.find((x) => x.id === b.dataset.e) : null);
  }));
  $('#playBtn').addEventListener('click', togglePlay);
}

function renderList() {
  const list = filtered();
  $('#stats').textContent = era
    ? `${list.length} מקומות בתקופה · מתוך ${PLACES.length}`
    : `${PLACES.length} מקומות · ${TOTAL_VISITS} ביקורים`;
  $('#list').innerHTML = list.length ? list.map((p) => `
    <button class="prow${p.id === sel ? ' on' : ''}" data-id="${esc(p.id)}" role="listitem">
      <span class="pn">${esc(p.name)}</span>
      <span class="pbar"><i style="width:${Math.round(p.visits.length / MAX_VISITS * 100)}%"></i></span>
      <span class="pc">${p.visits.length}</span>
    </button>`).join('') : emptyHtml();
  $('#list').querySelectorAll('.prow').forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));
  $('#clearEra')?.addEventListener('click', () => setEra(null));
}
/* רשימה ריקה בזמן שתקופה מסומנת היא מבוי סתום: המקום קיים, הוא פשוט
   מחוץ לתקופה, ובלי ההסבר הזה נראה שהחיפוש לא מצא אותו כלל. */
function emptyHtml() {
  if (era) {
    const q = norm(query);
    const elsewhere = PLACES.filter((p) => !q || hits(p.name, q) || p.aka.some((a) => hits(a, q))
      || p.visits.some((v) => hits(v.name, q))).length;
    if (elsewhere) {
      return `<p class="pempty">אין תוצאות ב${esc(era.name)}.<br>
        <button class="dfilter" id="clearEra">${elsewhere === 1 ? 'יש תוצאה אחת' : `יש ${elsewhere} תוצאות`} בשאר התקופות · הצג את כולן</button></p>`;
    }
  }
  return '<p class="pempty">אין מקום שמתאים לחיפוש הזה.</p>';
}

function setEra(e) {
  // בחירת תקופה היא שאלה על כל המפה, לא על העיר הפתוחה: יוצאים ממנה
  // חזרה לרשימה, אחרת המצלמה נשארה בזום של העיר והסמנים סביבה השתנו
  if (sel) select(null);
  era = e;
  renderEras(); renderList(); paintMarks(); moveCam();
}

// ==================== פירוט מקום ====================
/* כשתקופה מסומנת, הכרונולוגיה מוצגת מסוננת לפיה: אחרת בחירת "יהודה
   וישראל" הביאה את ירושלים על כל 36 ביקוריה, מאברהם ואילך, ולא ענתה
   על השאלה שנשאלה. שורת ההסבר מאפשרת לחזור לרשימה המלאה. */
let showAll = false;
function renderDetail(p) {
  const range = p.from === p.to ? `שנת ${p.from}` : `${p.from}–${p.to} לבריאה`;
  const inEraV = (v) => v.year >= era.start && v.year < era.end;
  const filtered = era && !showAll ? p.visits.filter(inEraV) : p.visits;
  const hidden = p.visits.length - filtered.length;
  $('#detail').innerHTML = `
    <button class="dback" id="dBack">→ חזרה לרשימה</button>
    <h2>${esc(p.name)}</h2>
    <p class="dsub">${p.visits.length} ביקורים · ${esc(range)}</p>
    ${nearKm(p) != null ? `<p class="dnear">📍 ${fmtKm(nearKm(p))} ממך</p>` : ''}
    ${p.aka.length ? `<p class="daka">נקרא גם: ${p.aka.map(esc).join(' · ')}</p>` : ''}
    ${p.lore ? `<p class="dlore">${esc(p.lore)}</p>` : ''}
    ${era && (hidden || showAll) ? `<button class="dfilter" id="dFilter">
      ${showAll ? `מוצגים כל הביקורים · הצג רק את ${esc(era.name)}`
        : `${filtered.length === 1 ? 'מוצג ביקור אחד' : `מוצגים ${filtered.length} ביקורים`} מתוך ${p.visits.length} - ${esc(era.name)} בלבד · הצג הכל`}</button>` : ''}
    <ul class="dvisits">${filtered.map((v) => `
      <li class="dv" style="--kc:${KIND_COLOR[v.kind] || 'var(--navy)'}">
        <div class="dvhead">
          <a class="dvname" href="/atlas?sel=${esc(v.kind)}:${esc(v.id)}">${esc(v.name)}</a>
          <span class="dvyear">${esc(KIND_LABEL[v.kind] || '')} · ${v.year}</span>
        </div>
        ${v.label ? `<p class="dvlabel">${esc(v.label)}</p>` : ''}
        ${v.desc ? `<p class="dvdesc">${esc(v.desc)}</p>` : ''}
        <a class="dvgo" href="/atlas?sel=${esc(v.kind)}:${esc(v.id)}">למסע של ${esc(v.name)} ←</a>
      </li>`).join('')}</ul>
    ${filtered.length ? '' : '<p class="pempty">אין ביקורים במקום הזה בתקופה שנבחרה.</p>'}`;
  $('#dBack').addEventListener('click', () => select(null));
  $('#dFilter')?.addEventListener('click', () => { showAll = !showAll; renderDetail(p); });
}

function select(id, replace = false) {
  // המקום שנפתח - זו התשובה ל"אילו מקומות מעניינים"
  if (id) markOnce('place_open', { id });
  sel = id && id !== sel ? id : (id || null);
  const p = sel ? PLACES.find((x) => x.id === sel) : null;
  showAll = false;                    // כל פתיחה מתחילה מסוננת לתקופה
  if (p) {
    stopPlay();
    renderDetail(p);
    $('#detail').hidden = false;
    $('#list').hidden = true;
    $('#detail').scrollTop = 0;
    if (window.matchMedia('(max-width:980px)').matches) {
      $('#side').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    sel = null;
    $('#detail').hidden = true;
    $('#list').hidden = false;
  }
  document.body.classList.toggle('has-sel', !!sel);
  renderNear();
  renderList();
  paintMarks();
  moveCam();
  const url = p ? `/places?p=${encodeURIComponent(p.id)}` : '/places';
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

// ==================== איפה אני ====================
const nearKm = (p) => {
  if (!near || near.state !== 'ok' || p.lat == null || p.approx) return null;
  const hit = near.list.find((n) => n.p.id === p.id);
  return hit ? hit.km : null;
};
const NEAR_MSG = {
  denied: 'לא התקבלה הרשאה למיקום. כדי לאפשר: בהגדרות הדפדפן ← הרשאות אתר ← מיקום, ואז ללחוץ שוב על "איפה אני".',
  timeout: 'לא הצלחנו לאתר את המיקום בזמן. כדאי לוודא שהמיקום (GPS) בטלפון דלוק ולנסות שוב.',
  unavailable: 'לא הצלחנו לאתר את המיקום. כדאי לוודא שהמיקום (GPS) בטלפון דלוק ולנסות שוב.',
  unsupported: 'הדפדפן הזה אינו יודע למסור מיקום.',
};

function renderNear() {
  const el = $('#near');
  // כשמקום פתוח, הפירוט תופס את הטור; הרשימה הקרובה חוזרת ב"חזרה לרשימה"
  el.hidden = !near || !!sel;
  if (el.hidden) return;
  const head = `<div class="nhead"><h2>📍 קרוב אליך</h2>
    <button class="nclose" id="nClose" aria-label="סגירת קרוב אליך">✕</button></div>`;
  let body;
  if (near.state === 'loading') body = '<p class="nmsg">מאתר את המיקום שלך…</p>';
  else if (near.state === 'error') body = `<p class="nmsg">${esc(near.msg)}</p>`;
  else if (near.state === 'outside') {
    body = `<p class="nmsg">נראה שאתה מחוץ לגבולות המפה. הכפתור מראה מקומות בארץ ישראל ובסביבתה -
      נסו אותו כשאתם בארץ.</p>`;
  } else {
    body = `<div class="nlist">${near.list.map(({ p, km }) => `
      <button class="nrow" data-id="${esc(p.id)}">
        <span class="nn">${esc(p.name)}${p.disputed ? '<small> · זיהוי שנוי במחלוקת</small>' : ''}</span>
        <span class="nk">${fmtKm(km)}</span>
      </button>`).join('')}</div>
      ${near.acc > 1000 ? `<p class="nnote">המיקום משוער, בטווח של כ-${fmtKm(near.acc / 1000)}.</p>` : ''}
      <p class="nnote">המרחקים בקו אווירי, ורוב הזיהויים של מקומות עתיקים משוערים.</p>`;
  }
  el.innerHTML = head + body;
  $('#nClose').addEventListener('click', closeNear);
  el.querySelectorAll('.nrow').forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));
}

function closeNear() {
  near = null;
  $('#locate').classList.remove('on');
  modern?.setNear(near);
  renderNear(); paintMe(); moveCam();
}

/* חיווי על הכפתור עצמו בזמן האיתור: GPS יכול לקחת כמה שניות, ובטלפון
   "קרוב אליך" יושב מתחת למפה - בלי זה הלחיצה נראתה כאילו לא קרה כלום. */
const LOCATE_LABEL = '📍 איפה אני';
function setLocateBusy(busy) {
  const b = $('#locate');
  b.classList.toggle('busy', busy);
  b.disabled = busy;
  b.setAttribute('aria-busy', busy ? 'true' : 'false');
  b.innerHTML = busy ? '<span class="spin" aria-hidden="true"></span> מאתר מיקום…' : LOCATE_LABEL;
}

async function locate() {
  if ($('#locate').disabled) return;
  stopPlay();
  near = { state: 'loading' };
  setLocateBusy(true);
  if (sel) select(null); else renderNear();
  let r;
  try {
    const c = await getPosition();
    const pt = locateOnMap(c.latitude, c.longitude);
    const list = pt ? nearest(PLACES, c.latitude, c.longitude) : [];
    if (!pt || !list.length || list[0].km > MAX_KM) {
      near = { state: 'outside' }; r = 'outside';
    } else {
      near = { state: 'ok', lat: c.latitude, lon: c.longitude, acc: c.accuracy || 0, pt, list }; r = 'ok';
      // השאלה היא "מה סביבי", לא "מה סביבי בתקופה X": סינון פעיל היה מעמעם
      // בדיוק את המקומות שברשימה
      if (era) { era = null; renderEras(); renderList(); paintMarks(); }
    }
  } catch (e) {
    const code = NEAR_MSG[e.message] ? e.message : 'unavailable';
    near = { state: 'error', msg: NEAR_MSG[code] }; r = code === 'denied' ? 'denied' : 'error';
  }
  // רק התוצאה, בלי שום קואורדינטה - ראו את ההערה בראש nearby.js
  mark('geo_locate', { r });
  setLocateBusy(false);
  $('#locate').classList.toggle('on', near.state === 'ok');
  modern?.setNear(near);
  renderNear(); paintMe(); moveCam();
}

// ==================== מפה מודרנית ====================
/* מתג "עתיקה | מודרנית". המפה המודרנית נבנית בפעם הראשונה שבוחרים בה, ומשם
   נשארת חיה ברקע: מעבר חוזר מיידי. הרשימה, הסינון, הבחירה ו"קרוב אליך"
   משותפים לשתיהן - main.js נשאר מקור האמת, ו-modern.js רק מצייר. */
let mode = 'ancient', modern = null, modernMod = null;
const modernState = () => ({ shownIds: new Set(filtered().map((p) => p.id)), selId: sel });
function modernFocus() {
  if (!modern) return;
  // "איפה אני" אינו מזיז את המפה המודרנית אל הגולש - ראו את ההערה ב-modern.js
  if (!sel && near && near.state === 'ok') return;
  modern.focus({ selId: sel, list: era ? PLACES.filter((p) => inEra(p, era)) : null });
}
function paintMode() {
  document.body.classList.toggle('modern', mode === 'modern');
  $('#modernMap').hidden = mode !== 'modern';
  $('#mapMode').querySelectorAll('button').forEach((b) => {
    const on = b.dataset.m === mode;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  });
}
async function setMode(m) {
  if (m === mode) return;
  if (m === 'modern') {
    const btn = $('#mapMode [data-m="modern"]');
    btn.classList.add('busy');
    try {
      modernMod ||= await import('./modern.js');
    } catch {
      btn.classList.remove('busy');
      return toast('לא הצלחנו לטעון את המפה המודרנית - רעננו את הדף');
    }
    btn.classList.remove('busy');
    if (!modernMod.supported()) return toast('המכשיר הזה אינו תומך במפה המודרנית');
    mode = 'modern';
    paintMode();
    if (!modern) {
      modern = modernMod.createModern($('#modernMap'), {
        places: PLACES,
        onSelect: (id) => select(id),
        onError: () => { toast('המפה המודרנית אינה זמינה כרגע'); setMode('ancient'); },
      });
    }
    modern.resize();
    modern.sync(modernState());
    modern.setNear(near);
    modernFocus();
  } else {
    mode = 'ancient';
    paintMode();
  }
  mark('map_mode', { m: mode });
}
$('#mapMode').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
// ניקוי הדגל של תקופת אב הטיפוס (?modern=1), שנשמר בדפדפן של מי שבדק אותו
try { localStorage.removeItem('si_modern'); } catch { /* אחסון חסום - אין מה לנקות */ }

// ==================== הרצת תקופות ====================
const PLAY_MS = 4200;
function togglePlay() {
  if (playT) return stopPlay();
  select(null);
  let i = era ? ERAS.findIndex((e) => e.id === era.id) : -1;
  if (i >= ERAS.length - 1) i = -1;          // עומדים בסוף - מתחילים מחדש
  const step = () => {
    i++;
    if (i >= ERAS.length) return stopPlay();
    setEra(ERAS[i]);                          // renderEras בונה את הכפתור מחדש
    const b = $('#playBtn'); if (b) b.textContent = '⏸ עצירה';
  };
  playT = setInterval(step, PLAY_MS);         // לפני הצעד הראשון, כדי ש-stopPlay יוכל לנקות
  step();
}
function stopPlay() {
  if (playT) { clearInterval(playT); playT = null; }
  const b = $('#playBtn'); if (b) b.textContent = '▶ הרצת תקופות';
}

// ==================== אתחול ====================
function openFromUrl(replace = true) {
  const q = new URLSearchParams(location.search);
  // ?era=<id> - הגעה משער הכניסה של דף-תקופה: המפה נפתחת כשהתקופה
  // כבר מסומנת. מוחל לפני הבחירה, כי setEra מנקה מקום פתוח.
  const e = q.get('era');
  if (e && (!era || era.id !== e)) {
    const hit = ERAS.find((x) => x.id === e);
    if (hit) setEra(hit);
  }
  const id = q.get('p');
  if (id && PLACES.some((p) => p.id === id)) select(id, replace);
  else select(null, replace);
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

drawMap();
renderEras();
renderList();
/* יחס הצדדים של קופסת המפה נמדד ולא מונח: ממנו נגזר ה-viewBox, וכל
   שינוי גודל חלון מחייב חישוב מחדש כדי שהתיבה תמשיך להיכנס בשלמותה.
   המדידה נעשית ישירות ולא רק דרך ResizeObserver, כי בלשונית שאינה
   מציירת פריימים ה-observer אינו נקרא כלל והמצלמה נשארת ביחס 1:1. */
function measureWrap() {
  const b = $('#mapWrap').getBoundingClientRect();
  if (!b.width || !b.height) return false;
  const ar = b.width / b.height;
  if (Math.abs(ar - wrapAR) < 0.005) return false;
  wrapAR = ar;
  return true;
}
const refit = (animate = false) =>
  setCam(camManual ? clampCam(cam.x + cam.w / 2 - (cam.h * wrapAR) / 2, cam.y, cam.h) : camFree ? fullCam() : camTarget(), animate);
measureWrap();
openFromUrl();
moveCam(false);
new ResizeObserver(() => { if (measureWrap()) refit(false); modern?.resize(); }).observe($('#mapWrap'));
addEventListener('resize', () => { if (measureWrap()) refit(false); });
// הגופן העברי מחליף את גופן הגיבוי אחרי הציור הראשון ומשנה גבהים בטור
document.fonts?.ready.then(() => { if (measureWrap()) refit(false); });

$('#locate').addEventListener('click', locate);
$('#map').addEventListener('pointerdown', onPtrDown);
addEventListener('pointermove', onPtrMove);
addEventListener('pointerup', onPtrUp);
addEventListener('pointercancel', onPtrUp);
// גרירה שהסתיימה מעל סמן אינה בחירה שלו. מאזין בשלב הלכידה, לפני מאזין הבחירה
$('#map').addEventListener('click', (e) => {
  if (dragged) { e.stopImmediatePropagation(); dragged = false; }
}, true);
$('#map').addEventListener('wheel', (e) => {
  e.preventDefault();
  const m = toMap(e.clientX, e.clientY);
  zoomAt(m.x, m.y, Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004));
}, { passive: false });
$('#map').addEventListener('dblclick', (e) => { const m = toMap(e.clientX, e.clientY); zoomAt(m.x, m.y, 0.5, true); });
const zoomCenter = (f) => zoomAt(cam.x + cam.w / 2, cam.y + cam.h / 2, f, true);
$('#zoomIn').addEventListener('click', () => zoomCenter(0.6));
$('#zoomOut').addEventListener('click', () => zoomCenter(1 / 0.6));

$('#reset').addEventListener('click', () => {
  camFree = true; camManual = false;
  setCam(fullCam());
});

$('#q').addEventListener('input', (e) => {
  query = e.target.value;
  if (sel) select(null);
  renderList(); paintMarks();
});
addEventListener('popstate', () => openFromUrl(true));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { stopPlay(); if (sel) select(null); }
});
/* React נטען רק כשבאמת פותחים את התיבה. ייבוא סטטי היה גורר ~150KB
   לכל מבקר במסך הזה, בשביל כפתור שרוב הגולשים לא ילחצו עליו. */
/* כישלון בטעינת הצ'אנק (בדרך כלל 404 אחרי פריסה) השאיר כאן כפתור
   מת בלי שום סימן למשתמש. עכשיו הוא לפחות אומר מה קרה. */
const openNotesSafe = () => import('../lib/notes.jsx')
  .then((m) => m.openNotes())
  .catch(() => toast('לא הצלחנו לטעון את החלק הזה - רעננו את הדף'));

$('#tNote').addEventListener('click', openNotesSafe);
$('#mAbout').addEventListener('click', () => {
  const el = document.createElement('div');
  el.className = 'ov';
  el.innerHTML = `<div class="ovpanel"><button class="ovclose" aria-label="סגירה">✕</button>
    <h2>ℹ️ אודות הפרויקט</h2><p class="osub">נבנה באהבה בידי חובב תנ״ך</p>
    <p class="oabout">הפרויקט נבנה באהבה בידי חובב תנ״ך, מתוך רצון לתרום לקהילה ולעזור לכולנו
    לעשות סדר בתולדות עם ישראל. ייתכנו אי-דיוקים בתאריכים, במפות, במיקומים ובפרטים -
    ואשמח לכל תיקון והערה. שימוש נעים! 📖</p>
    <p class="oabout"><a href="/privacy">מדיניות פרטיות</a> · <a href="/terms">תנאי שימוש</a> · <a href="/accessibility">נגישות</a></p></div>`;
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.classList.contains('ovclose')) el.remove();
  });
  document.body.appendChild(el);
});
// אותו shareLink של שני המסכים האחרים - ראו את ההערה שם
$('#tShare').addEventListener('click', async () => {
  const url = location.origin + '/places' + (sel ? `?p=${encodeURIComponent(sel)}` : '');
  const title = sel ? `${sel} - מפת הארץ` : 'מפת הארץ';
  const res = await shareLink({ url, title });
  if (res === 'copied') toast('הקישור הועתק ✓');
  else if (res === 'failed') toast('העתיקו מהכתובת שלמעלה');
});
