/* מפת המקומות - הציר השלישי של האתר.
   ציר הזמן שואל "מתי", מסע הדורות שואל "מי", וכאן שואלים "איפה":
   אותם 275 ביקורים, מסודרים לפי המקום ולא לפי הדמות. הנתונים מגיעים
   מ-src/data/places.json שנוצר בידי scripts/places-data.mjs. */
import { MAP_SRC, MAP_SIZE } from '../utils/mapProject.js';
import PLACES from '../data/places.json';
import PERIODS from '../data/periods.json';

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
     ${marks}<g id="labels">${labels}</g>
     <g id="cog" hidden><circle cx="0" cy="0" r="30"/><text x="0" y="-40" text-anchor="middle" font-size="20">מרכז הכובד</text></g>`;
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
const moveCam = (animate = true) => { camFree = false; setCam(camTarget(), animate); };

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
  $('#map').querySelectorAll('.lb').forEach((t) => {
    const on = t.classList.contains('on');
    const r = RAD(+t.dataset.v) * k * (on ? 1.3 : 1);
    t.setAttribute('font-size', ((on ? 24 : 21) * k).toFixed(1));
    t.setAttribute('y', (+t.dataset.y - r - 8 * k).toFixed(1));
    t.style.display = (+t.dataset.v >= need || on) ? '' : 'none';
  });
  const cg = $('#cog');
  if (cg && cogAt) {
    cg.querySelector('circle').setAttribute('r', (30 * k).toFixed(1));
    cg.querySelector('text').setAttribute('font-size', (20 * k).toFixed(1));
    cg.querySelector('text').setAttribute('y', (cogAt.cy - 40 * k).toFixed(1));
  }
}

/* מרכז הכובד: ממוצע מיקומי הביקורים בתקופה. זו התשובה החזותית לשאלה
   "איפה ההיסטוריה מתרחשת עכשיו" - הוא נודד דרומה עם ירידת ממלכת ישראל. */
let cogAt = null;
function paintCog() {
  const g = $('#cog');
  if (!era) { g.setAttribute('hidden', ''); cogAt = null; return; }
  let sx = 0, sy = 0, n = 0;
  for (const p of PLACES) for (const v of p.visits) {
    if (v.year >= era.start && v.year < era.end) { sx += p.x; sy += p.y; n++; }
  }
  if (!n) { g.setAttribute('hidden', ''); cogAt = null; return; }
  const cx = sx / n, cy = sy / n;
  cogAt = { cx, cy };
  g.removeAttribute('hidden');
  g.querySelector('circle').setAttribute('cx', cx.toFixed(1));
  g.querySelector('circle').setAttribute('cy', cy.toFixed(1));
  g.querySelector('text').setAttribute('x', cx.toFixed(1));
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
  paintCog();
  paintZoom();
}

// ==================== סינון ורשימה ====================
const norm = (s) => (s || '').replace(/[״"׳'־]/g, '').trim();
// התאמה בתחילת מילה בלבד, כמו בחיפוש של מסע הדורות: תת-מחרוזת חופשית
// הייתה מחזירה את "אשדוד" עבור "דוד".
const hits = (hay, q) => {
  const h = norm(hay);
  if (!h) return false;
  return new RegExp('(^|[\\s\\-–(,./])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h);
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
    </button>`).join('') : '<p class="pempty">אין מקום שמתאים לחיפוש הזה.</p>';
  $('#list').querySelectorAll('.prow').forEach((b) => b.addEventListener('click', () => select(b.dataset.id)));
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
    ${p.aka.length ? `<p class="daka">נקרא גם: ${p.aka.map(esc).join(' · ')}</p>` : ''}
    ${era && (hidden || showAll) ? `<button class="dfilter" id="dFilter">
      ${showAll ? `מוצגים כל הביקורים · הצג רק את ${esc(era.name)}`
        : `מוצגים ${filtered.length} מ-${p.visits.length} - ${esc(era.name)} בלבד · הצג הכל`}</button>` : ''}
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
  renderList();
  paintMarks();
  moveCam();
  const url = p ? `/places?p=${encodeURIComponent(p.id)}` : '/places';
  history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

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
  const id = new URLSearchParams(location.search).get('p');
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
const refit = (animate = false) => setCam(camFree ? fullCam() : camTarget(), animate);
measureWrap();
openFromUrl();
moveCam(false);
new ResizeObserver(() => { if (measureWrap()) refit(false); }).observe($('#mapWrap'));
addEventListener('resize', () => { if (measureWrap()) refit(false); });
// הגופן העברי מחליף את גופן הגיבוי אחרי הציור הראשון ומשנה גבהים בטור
document.fonts?.ready.then(() => { if (measureWrap()) refit(false); });

$('#reset').addEventListener('click', () => {
  camFree = true;
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
$('#mAbout').addEventListener('click', () => {
  const el = document.createElement('div');
  el.className = 'ov';
  el.innerHTML = `<div class="ovpanel"><button class="ovclose" aria-label="סגירה">✕</button>
    <h2>ℹ️ אודות הפרויקט</h2><p class="osub">נבנה באהבה בידי חובב תנ״ך</p>
    <p class="oabout">הפרויקט נבנה באהבה בידי חובב תנ״ך, מתוך רצון לתרום לקהילה ולעזור לכולנו
    לעשות סדר בתולדות עם ישראל. ייתכנו אי-דיוקים בתאריכים, במפות, במיקומים ובפרטים -
    ואשמח לכל תיקון והערה. שימוש נעים! 📖</p></div>`;
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.classList.contains('ovclose')) el.remove();
  });
  document.body.appendChild(el);
});
$('#tShare').addEventListener('click', async () => {
  const url = location.origin + '/places' + (sel ? `?p=${encodeURIComponent(sel)}` : '');
  const title = sel ? `${sel} - מפת המקומות` : 'מפת המקומות';
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url); toast('הקישור הועתק ✓');
  } catch { toast('העתיקו מהכתובת שלמעלה'); }
});
