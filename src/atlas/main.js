import { renderCard, clearCard } from './card.jsx';
import { renderMap } from './map.jsx';
import { ALL_ITEMS } from '../data/items.js';
import TOURS from '../data/tours.json';
import { shareLink } from '../lib/share.js';
import { startTrail, markOnce } from '../lib/trail.js';
startTrail();

const $ = (s) => document.querySelector(s);
// אותו סדר כמו רצועות ציר הזמן עצמו
const LAYERS = [
  { key:'events',  label:'אירועים',       color:'var(--event)',   icon:'◆'  },
  { key:'leaders', label:'אבות ומנהיגים', color:'var(--leader)',  icon:'🏛️' },
  { key:'judges',  label:'שופטים',        color:'var(--judge)',   icon:'⚖️' },
  { key:'kings',   label:'מלכים',         color:'var(--judah)',   icon:'👑' },
  { key:'prophets',label:'נביאים',        color:'var(--prophet)', icon:'📜' },
  { key:'books',   label:'ספרי תנ״ך',     color:'var(--book)',    icon:'📖' },
  { key:'world',   label:'רקע עולמי',     color:'var(--world)',   icon:'🌍' },
];
const KIND_COLOR = { leader:'var(--leader)', judge:'var(--judge)', united:'var(--united)', judah:'var(--judah)',
  israel:'var(--israel)', prophet:'var(--prophet)', book:'var(--book)', event:'var(--event)', world:'var(--world)' };
const KIND_ICON = { leader:'🏛️', judge:'⚖️', united:'👑', judah:'👑', israel:'👑',
  prophet:'📜', book:'📖', event:'◆', world:'🌍' };
const JUD = { good:"עשה הישר בעיני ה'", bad:"עשה הרע בעיני ה'", mixed:'מעורב' };
// חיצים כ-SVG (חסינים לשיקוף bidi): קודקוד מימין = מצביע ימינה, ולהפך
const chev = (d) => `<svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="${d}"
  fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEV_R = chev('M9 4 L17 12 L9 20');
const CHEV_L = chev('M15 4 L7 12 L15 20');

let DATA = null, items = [], visible = [], active = -1, renderT = null, balanceT = null;
let on = Object.fromEntries(LAYERS.map(l => [l.key, true]));
try { const s = JSON.parse(localStorage.getItem('atlas_layers')); if (s) on = { ...on, ...s }; } catch {}

// ==================== בנייה ====================
async function build() {
  DATA = await (await fetch('/atlas-data.json')).json();
  DATA.eras.forEach(e => e.items.forEach(it => items.push(it)));
  $('#eras').innerHTML = DATA.eras.map((e,i) => `<button class="echip" data-e="${i}">${e.title}</button>`).join('');
  // לחיצה על תקופה = מעבר לפריט הראשון שלה. (חישוב לפי כותרת התקופה אינו
  // אמין: היא sticky, ולכן ה-rect שלה הוא המיקום הנעוץ ולא המיקום בדף.)
  $('#eras').querySelectorAll('.echip').forEach(b => b.addEventListener('click', () => {
    const first = document.querySelector(`.card:not(.hidden)[data-era="${b.dataset.e}"]`);
    if (first) centerCard(first);
    else toast('אין פריטים גלויים בתקופה זו - בדקו את השכבות');
  }));
  syncBar();
  renderStory();
  balanceColumns();
  initSearch();
  openFromUrl();
  if (new URLSearchParams(location.search).get('tour') === '1') setTimeout(startTour, 700);
  addEventListener('scroll', pick, { passive: true });
  setInterval(pick, 300);
  addEventListener('resize', () => {
    if (!isNarrow()) document.body.classList.remove('sheet-open', 'map-open');  // מצבי מובייל בלבד
    syncBar(); syncFilterHeight(); balanceColumns(); placeSearch();
  });
  $('#sheetBack').addEventListener('click', closeSheet);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.querySelector('.ov')) return document.querySelectorAll('.ov').forEach(o => o.remove());
      if (document.body.classList.contains('map-open')) return closeMap();
      return closeSheet();
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (inField(e.target) || document.querySelector('.ov')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); navFigure(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); navFigure(-1); }
    else if (e.key === ' ' || e.key === 'Spacebar') {
      if (onControl(e.target)) return;                 // רווח מפעיל כפתור ממוקד
      e.preventDefault(); navEra(e.shiftKey ? -1 : 1);
    }
  });
}

function renderStory() {
  const html = [];
  let gi = 0;
  // שורת הסינון - יושבת בראש רשימת השמות, לא בסרגל העליון
  // "הצג:" הוא כפתור פתיחה: במגע אין ריחוף, ולכן ה-title של כל אייקון
  // לא נגיש כלל - בלי השורה הזו המבקר לא יודע מה כל סמל מסמן.
  html.push(`<div id="filters">
    <button class="flab" id="flegend" aria-expanded="false" aria-controls="fnames">הצג:
      <svg class="lt-caret" viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M4 9 L12 17 L20 9"
        fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>` +
    LAYERS.map(l => `<button class="fbtn" data-l="${l.key}" style="--kc:${l.color}"
      aria-pressed="${on[l.key]}" title="${l.label}"><span class="gl">${l.icon}</span></button>`).join('') +
    `<span class="fcnt" id="fcnt"></span>
    <div class="fnames" id="fnames" hidden>${LAYERS.map(l => `<button class="fname" data-l="${l.key}"
      style="--kc:${l.color}" aria-pressed="${on[l.key]}"><span class="gl">${l.icon}</span>${l.label}</button>`).join('')}</div>` +
    `<span class="khint"><kbd>↑</kbd><kbd>↓</kbd> מעבר בין דמויות · <kbd>רווח</kbd> מעבר בין תקופות</span></div>`);
  DATA.eras.forEach((era, ei) => {
    html.push(`<div class="ehead" id="eh-${ei}">✦ <b>${era.title}</b> · ${era.start}–${era.end}</div>`);
    era.items.forEach((it) => {
      const idx = items.indexOf(it);
      html.push(`<article class="card${on[it.layer] ? '' : ' hidden'}" data-i="${idx}" data-era="${ei}" data-layer="${it.layer}">
        <span class="kicon${it.kind==='event'?' k-event':''}" style="--kc:${KIND_COLOR[it.kind]}"
          title="${it.kindLabel}"><span class="gl">${KIND_ICON[it.kind]}</span></span>
        <div class="cbody">
          <h3>${it.name}</h3>
          <div class="sub">${it.kindLabel} · ${it.start}–${it.end}${it.approx ? ' ≈' : ''}</div>
          <div class="more">${it.verse ? `<i>„${it.verse}”</i><br/>` : ''}${it.desc.slice(0,190)}${it.desc.length>190?'…':''}</div>
        </div>
      </article>`);
      gi++;
    });
  });
  $('#story').innerHTML = html.join('');
  // בדסקטופ הלחיצה ממרכזת בציר; במובייל היא פותחת את הכרטיס כגיליון
  document.querySelectorAll('.card').forEach(el => el.addEventListener('click', () => {
    if (isNarrow()) openSheet(+el.dataset.i); else centerCard(el);
  }));
  $('#filters').querySelectorAll('.fbtn,.fname').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.l;
    on[k] = !on[k];
    $('#filters').querySelectorAll(`[data-l="${k}"]`).forEach(x => x.setAttribute('aria-pressed', on[k]));
    applyFilters();
  }));
  $('#flegend').addEventListener('click', () => {
    const box = $('#fnames'), open = box.hidden;
    box.hidden = !open;
    $('#flegend').setAttribute('aria-expanded', String(open));
    $('#flegend').classList.toggle('open', open);
    syncFilterHeight();                 // כותרות התקופה נצמדות לגובה החדש
  });
  placeSearch();
  applyFilters();
}
/* החיפוש יושב תמיד בראש הרשימה שהוא מחפש בה - שורה משלו, בדיוק כמו
   בציר הזמן. מזיזים את האלמנט הקיים (ולא בונים חדש) כדי לשמור את
   מאזיני האירועים. */
function placeSearch() {
  const s = $('#search'); if (!s) return;
  const host = $('#filters');
  if (host && s.parentElement !== host) host.insertBefore(s, host.firstChild);
  s.hidden = false;
}
function applyFilters() {
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('hidden', !on[c.dataset.layer]));
  try { localStorage.setItem('atlas_layers', JSON.stringify(on)); } catch {}
  refreshVisible();
  const n = document.querySelectorAll('.card:not(.hidden)').length;
  const f = $('#fcnt'); if (f) f.textContent = n + ' פריטים';
  // כשכל השכבות כבויות הטור נשאר ריק לגמרי, ולא ברור אם משהו נשבר
  let empty = $('#storyEmpty');
  if (!n) {
    if (!empty) {
      empty = document.createElement('p');
      empty.id = 'storyEmpty';
      empty.innerHTML = 'אין פריטים להצגה - כל השכבות כבויות.<br><button class="tool" id="allLayers">הדלקת כל השכבות</button>';
      $('#filters').after(empty);
      $('#allLayers').addEventListener('click', () => {
        LAYERS.forEach((l) => { on[l.key] = true; });
        $('#filters').querySelectorAll('[data-l]').forEach((x) => x.setAttribute('aria-pressed', 'true'));
        applyFilters();
      });
    }
  } else if (empty) empty.remove();
  syncFilterHeight();
}
// גובה שורת הסינון נמדד - כותרות התקופה נצמדות מתחתיה ולא עליה
function syncFilterHeight() {
  const el = $('#filters'); if (!el) return;
  document.documentElement.style.setProperty('--filt-h', Math.round(el.getBoundingClientRect().height) + 'px');
}
const refreshVisible = () => {
  visible = [...document.querySelectorAll('.card:not(.hidden)')];
  pick(true);
};
const isNarrow = () => matchMedia('(max-width:980px)').matches;
const focusLine = () => innerHeight * (isNarrow() ? .5 : .45);

// סימון הפריט הפעיל מיידית (בלי להמתין לסיום הגלילה) - כך ניווט המקלדת מגיב
// בלחיצה עצמה, ולא רק כשהכרטיס מגיע לקו הבחירה.
function markActive(i) {
  document.querySelectorAll('.card').forEach(el => el.classList.toggle('on', +el.dataset.i === i));
  active = i; render(); markEra(i);
}
// ===== מובייל: גיליון הכרטיס ושכבת המפה =====
function openSheet(i) {
  markActive(i);
  document.body.classList.add('sheet-open');
}
const closeSheet = () => document.body.classList.remove('sheet-open');
const openMap = () => document.body.classList.add('map-open');
const closeMap = () => document.body.classList.remove('map-open');
// גובה הסרגל נמדד בפועל (הוא נשבר לשתי שורות במובייל) - כך הפריסה לא מתפספסת
function syncBar() {
  const h = Math.round($('#bar').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--bar', h + 'px');
}
// גלילה חלקה משלנו - scrollTo({behavior:'smooth'}) אינו אמין בכל הסביבות.
// רשת ביטחון: אם rAF אינו רץ (למשל בלשונית שאינה מקומפזת), קופצים ליעד.
let animT = null, safeT = null, animDone = true;
function scrollToY(target) {
  cancelAnimationFrame(animT); clearTimeout(safeT);
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, Math.round(target)));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo(0, to); pick(); return; }
  const from = scrollY, dist = to - from, t0 = performance.now();
  const dur = Math.min(650, 180 + Math.abs(dist) * .35);
  const ease = (t) => (t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2);
  animDone = false;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    scrollTo(0, from + dist * ease(t));
    if (t < 1) { animT = requestAnimationFrame(tick); } else { animDone = true; pick(); }
  };
  animT = requestAnimationFrame(tick);
  safeT = setTimeout(() => { if (!animDone) { cancelAnimationFrame(animT); scrollTo(0, to); animDone = true; pick(); } }, dur + 140);
}
// כרטיסים בקצוות הדף אינם יכולים להגיע לקו הבחירה (הגלילה נחסמת) - במקרה
// כזה "נועצים" את הבחירה עליהם, והנעיצה משתחררת ברגע שהמשתמש גולל בעצמו.
let pinned = null;
['wheel', 'touchstart', 'keydown'].forEach((ev) =>
  addEventListener(ev, () => { pinned = null; }, { passive: true }));

// כניסה מציר הזמן או מקישור משותף: /atlas?sel=kind:id (גם id בלבד נתמך).
// אם הפריט מסונן החוצה, מדליקים את השכבה שלו כדי שהוא באמת ייראה.
// ==================== חיפוש ====================
// שלוש קבוצות נפרדות, כמו בציר הזמן: התאמה ישירה בשם, מקום על מסלול המסע,
// ואזכור בגוף הטקסט. הפרדה זו מונעת ערבוב של "דוד" הדמות עם "עיר דוד".
const norm = (s) => (s || '').replace(/[״"׳'־]/g, '').trim();
// התאמה בתחילת מילה בלבד. חיפוש תת-מחרוזת חופשי החזיר את "אשדוד" עבור
// "דוד" ואת "מרים" עבור "רים" - רעש שמטשטש את התוצאה האמיתית.
const hits = (hay, q) => {
  const h = norm(hay);
  if (!h) return false;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[\\s\\-–(,./"׳״])' + esc).test(h);
};
function searchItems(raw) {
  const q = norm(raw);
  if (q.length < 2) return [];
  const name = [], place = [], text = [];
  items.forEach((it, i) => {
    if (hits(it.name, q)) { name.push({ i, it, why: it.kindLabel }); return; }
    const pt = it.map && it.map.points.find((p) => hits(p.name, q));
    if (pt) { place.push({ i, it, why: pt.name }); return; }
    if (hits(it.desc, q) || hits(it.verse, q)) text.push({ i, it, why: 'אזכור בתיאור' });
  });
  const cut = (a, n) => a.sort((x, y) => x.it.start - y.it.start).slice(0, n);
  return [
    { label: 'התאמה בשם', rows: cut(name, 8) },
    { label: 'עבר במקום הזה', rows: cut(place, 6) },
    { label: 'מוזכר בתיאור', rows: cut(text, 5) },
  ].filter((g) => g.rows.length);
}
let qRows = [], qSel = -1;
function renderResults(raw) {
  const box = $('#qres'), groups = searchItems(raw);
  qRows = groups.flatMap((g) => g.rows); qSel = -1;
  if (norm(raw).length < 2) { box.classList.remove('show'); $('#q').setAttribute('aria-expanded', 'false'); return; }
  if (!groups.length) {
    box.innerHTML = `<div class="qempty">לא נמצאו תוצאות עבור "${raw}"</div>`;
    // מה חיפשו ולא מצאו - זו רשימת התוכן החסר באתר
    markOnce('search_miss', { q: raw.trim().slice(0, 40) });
  } else {
    let k = 0;
    box.innerHTML = groups.map((g) =>
      `<div class="qgroup">${g.label}</div>` + g.rows.map((r) =>
        `<button data-k="${k++}" data-go="${r.i}" role="option">
           <span class="qi" style="color:${KIND_COLOR[r.it.kind]}">${KIND_ICON[r.it.kind]}</span>
           <span class="qn">${r.it.name}</span><span class="qm">${r.why} · ${r.it.start}–${r.it.end}</span>
         </button>`).join('')).join('');
    box.querySelectorAll('button').forEach((b) =>
      b.addEventListener('mousedown', (e) => { e.preventDefault(); pickResult(+b.dataset.go); }));
  }
  box.classList.add('show'); $('#q').setAttribute('aria-expanded', 'true');
}
function pickResult(i) {
  closeSearch();
  goIndex(i);
}
function moveSel(d) {
  if (!qRows.length) return;
  qSel = (qSel + d + qRows.length) % qRows.length;
  $('#qres').querySelectorAll('button').forEach((b, k) => b.classList.toggle('sel', k === qSel));
  $('#qres').querySelector('button.sel')?.scrollIntoView({ block: 'nearest' });
}
function closeSearch() {
  $('#qres').classList.remove('show');
  $('#q').value = ''; $('#q').blur(); $('#q').setAttribute('aria-expanded', 'false');
  qRows = []; qSel = -1;
}
function initSearch() {
  const q = $('#q');
  q.addEventListener('input', () => renderResults(q.value));
  q.addEventListener('focus', () => { if (q.value) renderResults(q.value); });
  q.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') { const r = qRows[qSel >= 0 ? qSel : 0]; if (r) { e.preventDefault(); pickResult(r.i); } }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  });
  // סגירה בלחיצה בחוץ; mousedown על תוצאה כבר טופל לפני שה-blur מבטל אותה
  addEventListener('mousedown', (e) => {
    if (!e.target.closest('#search')) closeSearch();
  });
}

// ==================== סיור קצר ====================
// מגיעים לכאן מ-/atlas?tour=1, כשהמבקר ביקש הדרכה במסך הפתיחה. זרקור על
// אזור אחד בכל פעם, במקום שקפים שמסתירים את המסך ומלמדים לפני שרואים.
// במסך צר הכרטיס והמפה נפתחים רק בהקשה, ולכן אין טעם להצביע עליהם - הם
// יושבים מתחת לקצה המסך. שם מסבירים אותם בתוך שלב הרשימה.
const TOUR_WIDE = [
  { sel: '#story', title: 'הסיפור נגלל', text: 'הדמויות והאירועים מסודרים לפי סדר הדורות. גללו, ולחצו על שם כדי לפתוח אותו.' },
  { sel: '#eras', title: 'קפיצה בין תקופות', text: 'סרגל התקופות. לחיצה מקפיצה לתחילת התקופה, ורווח במקלדת מדלג לבאה.' },
  { sel: '#filters', title: 'חיפוש וסינון', text: 'כאן מחפשים דמות, אירוע או מקום - וכאן בוחרים מה יופיע ברשימה. השורה נשארת גלויה גם בגלילה.', picker: true },
  { sel: '#detail', title: 'הכרטיס המלא', text: 'הסיפור, הפסוק, המקורות, בני-הזמן, וקישור לאותה דמות על ציר הזמן.' },
  { sel: '#mapPane', title: 'המפה', text: 'למי שיש מסע - התחנות מסומנות על המפה, ואפשר להריץ אותו תחנה אחר תחנה.' },
];
const TOUR_NARROW = [
  { sel: '#story', title: 'הסיפור נגלל', text: 'הדמויות והאירועים לפי סדר הדורות. הקישו על שם כדי לפתוח את הכרטיס המלא - ובתוכו גם כפתור לפתיחת המפה.' },
  { sel: '#eras', title: 'קפיצה בין תקופות', text: 'סרגל התקופות. הקשה מקפיצה לתחילת התקופה שבחרתם.' },
  { sel: '#filters', title: 'חיפוש וסינון', text: 'כאן מחפשים דמות, אירוע או מקום - וכאן בוחרים מה יופיע ברשימה. השורה נשארת גלויה גם בגלילה.', picker: true },
];
let TOUR = TOUR_WIDE, tourStep = 0;
function startTour() { TOUR = isNarrow() ? TOUR_NARROW : TOUR_WIDE; tourStep = 0; showTourStep(); }
function endTour() {
  document.querySelector('.tour-wrap')?.remove();
  history.replaceState({}, '', location.pathname + location.search.replace(/[?&]tour=1/, '').replace(/^&/, '?'));
}
function showTourStep() {
  document.querySelector('.tour-wrap')?.remove();
  const s = TOUR[tourStep];
  if (!s) return endTour();
  const el = document.querySelector(s.sel);
  if (!el) { tourStep++; return showTourStep(); }        // אזור שאינו מוצג במסך הזה
  const r0 = el.getBoundingClientRect();
  if (r0.width < 8 || r0.height < 8) { tourStep++; return showTourStep(); }
  // חותכים לגבולות החלון: אזורים רחבים (המפה) גולשים החוצה, והטבעת נראית קטועה.
  // clientWidth ולא innerWidth - האחרון כולל את פס הגלילה, והשכבה (inset:0) לא.
  const VW = document.documentElement.clientWidth, VH = document.documentElement.clientHeight;
  // יעד שנמצא מחוץ למסך (למשל גיליון סגור) - מדלגים, אחרת החיתוך שלמטה היה
  // מצייר טבעת סביב שטח ריק.
  if (r0.bottom < 24 || r0.top > VH - 24 || r0.right < 24 || r0.left > VW - 24) {
    tourStep++; return showTourStep();
  }
  const pad = 6, M = 4;
  const b = {
    left: Math.max(M, r0.left - pad), right: Math.min(VW - M, r0.right + pad),
    top: Math.max(M, r0.top - pad), bottom: Math.min(VH - M, r0.bottom + pad),
  };
  b.width = b.right - b.left; b.height = b.bottom - b.top;
  const wrap = document.createElement('div');
  wrap.className = 'tour-wrap';
  wrap.innerHTML =
    `<div class="tour-ring" style="top:${b.top}px;right:${VW - b.right}px;
       width:${b.width}px;height:${b.height}px"></div>
     <div class="tour-box">
       <b>${s.title}</b><p>${s.text}</p>
       ${s.picker ? `<div class="tpick">${LAYERS.map(l =>
         `<button class="tp" data-l="${l.key}" aria-pressed="${on[l.key]}" style="--kc:${l.color}">
            <span class="gl">${l.icon}</span>${l.label}</button>`).join('')}</div>` : ''}
       <div class="tour-nav">
         <span>${tourStep + 1}/${TOUR.length}</span>
         <button class="tskip">דילוג</button>
         <button class="tnext primary">${tourStep === TOUR.length - 1 ? 'סיום' : 'הבא'}</button>
       </div>
     </div>`;
  document.body.appendChild(wrap);
  // בחירת השכבות בתוך הסיור משנה מיד את הרשימה שמאחור, כדי שהמבקר יראה
  // את התוצאה של הבחירה ולא רק ישמע עליה
  wrap.querySelectorAll('.tp').forEach(b => b.addEventListener('click', () => {
    on[b.dataset.l] = !on[b.dataset.l];
    b.setAttribute('aria-pressed', on[b.dataset.l]);
    $('#filters').querySelector(`.fbtn[data-l="${b.dataset.l}"]`)?.setAttribute('aria-pressed', on[b.dataset.l]);
    applyFilters();
  }));
  // התיבה יושבת בצד הפנוי הגדול יותר כדי שלא תכסה את מה שהיא מסבירה; אם אין
  // צד פנוי (המפה תופסת כמעט הכול) היא יורדת לתחתית האזור.
  const box = wrap.querySelector('.tour-box');
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const clampTop = (v) => Math.min(Math.max(12, v), VH - bh - 12);
  // right נמדד מקצה החלון הימני: להצמדה משמאל ליעד הקצה השמאלי של התיבה
  // צריך לשבת ב-b.right, כלומר right = freeR-bw-14. חישוב שגוי כאן גרם
  // לתיבה לכסות בדיוק את מה שהיא מסבירה.
  const freeR = VW - b.right, freeL = b.left;
  if (freeR >= freeL && freeR > bw + 20) { box.style.right = Math.max(12, freeR - bw - 14) + 'px'; box.style.top = clampTop(b.top) + 'px'; }
  else if (freeL > bw + 20) { box.style.right = (VW - b.left + 14) + 'px'; box.style.top = clampTop(b.top) + 'px'; }
  else {
    // אין צד פנוי (מסך צר): ליעד קטן מציבים מתחתיו או מעליו, ליעד שממלא
    // את המסך נכנסים לתוכו בתחתיתו
    const below = b.bottom + 12, above = b.top - bh - 12;
    const y = below + bh + 12 <= VH ? below : (above >= 12 ? above : b.bottom - bh - 14);
    box.style.right = Math.max(12, VW - b.right + (b.width - bw) / 2) + 'px';
    box.style.top = clampTop(y) + 'px';
  }
  wrap.querySelector('.tnext').addEventListener('click', () => { tourStep++; showTourStep(); });
  wrap.querySelector('.tskip').addEventListener('click', endTour);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) endTour(); });
}

// מעבר לפריט לפי אינדקס, גם אם השכבה שלו מסוננת כרגע - אחרת הקישור "נבלע"
function goIndex(i) {
  if (i < 0 || !items[i]) return;
  if (!on[items[i].layer]) {
    on[items[i].layer] = true;
    $('#filters').querySelector(`.fbtn[data-l="${items[i].layer}"]`)?.setAttribute('aria-pressed', 'true');
    applyFilters();
  }
  const el = document.querySelector(`.card[data-i="${i}"]`);
  if (el) { navIdx = visible.indexOf(el); goCard(el); }
}

function openFromUrl() {
  const sel = new URLSearchParams(location.search).get('sel');
  if (!sel) return;
  const id = sel.includes(':') ? sel.split(':')[1] : sel;
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return;
  if (!on[items[i].layer]) {
    on[items[i].layer] = true;
    $('#filters').querySelector(`.fbtn[data-l="${items[i].layer}"]`)?.setAttribute('aria-pressed', 'true');
    applyFilters();
  }
  // הפריסה ממשיכה לזוז אחרי הטעינה (פונטים, גובה המפה), ולכן יעד שחושב מוקדם
  // מדי נוחת על כרטיס שכן. קופצים אחרי שהפונטים מוכנים, ומיישרים שוב ברגע
  // שהפריסה נרגעה - כל עוד המשתמש לא גלל בעצמו בינתיים.
  const jump = () => {
    const el = document.querySelector(`.card[data-i="${i}"]`);
    if (el) goCard(el);
  };
  let moved = false;
  const mark = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, mark, { passive: true }));
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => setTimeout(jump, 60));
  setTimeout(() => {
    if (!moved) jump();
    ['wheel', 'touchstart', 'keydown'].forEach(ev => removeEventListener(ev, mark));
  }, 700);
}

// ==================== ניווט במקלדת ====================
// ↓/↑ = דמות אחת בכל לחיצה. רווח = התקופה הבאה, Shift+רווח = הקודמת.
// navIdx מחזיק את היעד שנבחר זה עתה, כדי שלחיצות רצופות ימשיכו קדימה גם
// בזמן שאנימציית הגלילה עדיין רצה (active מתעדכן רק בסופה).
let navIdx = null;
['wheel', 'touchstart'].forEach((ev) =>
  addEventListener(ev, () => { navIdx = null; }, { passive: true }));

function goCard(el) {
  if (!el) return;
  const i = +el.dataset.i;
  if (isNarrow()) { openSheet(i); el.scrollIntoView({ block: 'center' }); }
  else { markActive(i); centerCard(el); }
}
function navFigure(dir) {
  if (!visible.length) return;
  const at = navIdx !== null ? navIdx : visible.findIndex(el => +el.dataset.i === active);
  const to = at < 0 ? (dir > 0 ? 0 : visible.length - 1)
                    : Math.min(visible.length - 1, Math.max(0, at + dir));
  navIdx = to;
  goCard(visible[to]);
}
function navEra(dir) {
  if (!visible.length) return;
  const at = navIdx !== null ? navIdx : visible.findIndex(el => +el.dataset.i === active);
  const ei = at >= 0 ? +visible[at].dataset.era : 0;
  for (let e = ei + dir; e >= 0 && e < DATA.eras.length; e += dir) {
    const first = visible.find(el => +el.dataset.era === e);   // תקופות ריקות מדולגות
    if (first) { navIdx = visible.indexOf(first); return goCard(first); }
  }
  toast(dir > 0 ? 'זו התקופה האחרונה' : 'זו התקופה הראשונה');
}
const inField = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
// רווח על כפתור ממוקד צריך להפעיל אותו (נגישות) - לכן מדלגים על פקדים. כדי
// שקליק-עכבר לא ישאיר מיקוד תקוע על כפתור, מסירים אותו אחרי לחיצת עכבר בלבד.
const onControl = (t) => !!t && !!t.closest?.('button,a,[role="button"]');
addEventListener('mouseup', (e) => { const b = e.target.closest?.('button'); if (b) b.blur(); });

function centerCard(el) {
  const b = el.getBoundingClientRect();
  const want = scrollY + b.top + b.height / 2 - focusLine();
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, want));
  pinned = Math.abs(to - want) > 2 ? +el.dataset.i : null;
  scrollToY(to);
  if (pinned !== null) pick(true);
}

// ==================== מפה ====================
// המפה ריבועית, ולכן בחלון רחב-ונמוך נותרים שוליים ריקים בצדדים. מרחיבים את
// עמודת הפירוט כדי לצמצם את חלון המפה לריבוע - כך המפה ממלאת את מלוא רוחבו.
// מצמצמים את חלון המפה לריבוע (עד גבול סביר) כדי שהמפה הריבועית תמלא אותו -
// העודף עובר לעמודת הפירוט, אך היא לא גדלה מעבר ל-430px.
// חלון המפה מכוון להיות ריבועי (כגובהו) כדי שהמפה הריבועית תמלא אותו בלי
// שוליים; מה שנותר אחרי המקרא, השמות והתקופות עובר לעמודת הפירוט.
function balanceColumns() {
  const root = document.documentElement;
  if (isNarrow()) { root.style.removeProperty('--detail-w'); root.style.removeProperty('--map-w'); return; }
  const pane = $('#mapPane');
  if (!pane) return;
  // חלון המפה ריבועי, וגובהו נקבע ממה שנשאר אחרי הכותרת, הבקרות והמקרא.
  // רוחב העמודה נגזר ממנו - אחרת נשאר לצדו שטח ריק, והפירוט מקבל פחות מקום.
  const wrap = pane.querySelector('.map-wrap');
  const boxH = wrap ? wrap.getBoundingClientRect().height : pane.getBoundingClientRect().height;
  const storyW = $('#story').getBoundingClientRect().width;
  const cssVar = (n) => parseFloat(getComputedStyle(root).getPropertyValue(n)) || 0;
  // clientWidth ולא innerWidth - האחרון כולל את פס הגלילה וגורם לחפיפת עמודות
  const free = document.documentElement.clientWidth - storyW - cssVar('--era-w');
  const PANEL_PAD = 28;
  // רוחב מינימלי לעמודת הפירוט: הכרטיס תוכנן ל-340, ומתחת לזה השורות
  // נשברות באמצע. שני הסייגים שהיו כאן (320 ואז 300) גם לא הסכימו זה עם זה.
  const DETAIL_MIN = 360;
  let mapW = Math.max(430, Math.min(boxH + PANEL_PAD, free - DETAIL_MIN));
  root.style.setProperty('--map-w', Math.round(mapW) + 'px');
  root.style.setProperty('--detail-w', Math.round(free - mapW) + 'px');
}
// המפה מרונדרת ע"י אותו רכיב React של ציר הזמן (JourneyMap); כאן נשארה רק
// חלוקת הרוחב בין העמודות. ה-viewBox של ה-SVG הוא המצלמה, ו-slice מבטיח
// שהתמונה מכסה את החלון בלי פסים ריקים - מה שקודם חושב ידנית ב-fitMap.
// המבט הנוכחי והפריט הנבחר נשמרים בכתובת, כדי שמעבר לציר הזמן (ושיתוף)
// ינחתו על אותה דמות ולא בראש הדף.
function syncViewLink() {
  const it = items[active];
  const q = it ? '?sel=' + it.kind + ':' + it.id : '';
  const a = $('#toTimeline');
  if (a) {
    a.href = '/' + q;
    a.title = it ? 'הצגת ' + it.name + ' על ציר הזמן' : 'מעבר לתצוגת ציר הזמן';
  }
  try { history.replaceState({}, '', '/atlas' + q); } catch {}
}

// המפה והכרטיס מרונדרים ע"י אותם רכיבי React של ציר הזמן.
function render() {
  const it = items[active];
  syncViewLink();
  renderDetail(it);
  renderMap(it ? it.kind + ':' + it.id : null, { onClose: isNarrow() ? closeMap : undefined });
  // המפה נכנסה לעמודה ושינתה את גובה הריבוע - מאזנים שוב אחרי הציור
  clearTimeout(balanceT);
  balanceT = setTimeout(balanceColumns, 60);
}

// ==================== פאנל הפירוט ====================
// כרטיס הפריט מרונדר ע"י אותו רכיב React של ציר הזמן (src/atlas/card.jsx).
// כאן רק מחשבים את השכנים ומעבירים את הפעולות שייחודיות למסע.
function renderDetail(it) {
  const d = $('#detail'); if (!d) return;
  if (!it) { clearCard(); return; }
  const vi = visible.indexOf(document.querySelector(`.card[data-i="${active}"]`));
  const prevEl = vi > 0 ? visible[vi - 1] : null;
  const nextEl = vi >= 0 && vi < visible.length - 1 ? visible[vi + 1] : null;
  const at = (el) => (el ? items[+el.dataset.i] : null);
  const full = (x) => (x ? ALL_ITEMS.find((o) => o.kind === x.kind && o.id === x.id) : null);
  renderCard({
    key: `${it.kind}:${it.id}`,
    prev: full(at(prevEl)), next: full(at(nextEl)),
    onNav: (target) => goIndex(items.findIndex((o) => o.kind === target.kind && o.id === target.id)),
    // בדסקטופ המפה פרושׂה לצד הכרטיס; במסך צר היא נפתחת כשכבה, ולכן שם
    // הכרטיס צריך גם כפתור מפה וגם כפתור סגירה.
    onClose: isNarrow() ? closeSheet : undefined,
    onOpenMap: isNarrow() ? openMap : undefined,
    onOpenCollection: openCollection,
  });
  d.scrollTop = 0;
}

// ==================== גלילה חד-ערכית ====================
const markEra = (idx) => {
  const card = document.querySelector(`.card[data-i="${idx}"]`);
  const ei = card ? +card.dataset.era : 0;
  // עומק הגלילה, ולא כל פריט: המסך גלילתי, ו"עברתי ליד" אינו "התעניינתי"
  const chip = $(`#eras .echip[data-e="${ei}"]`);
  if (chip) markOnce('era_reached', { era: chip.textContent.trim() });
  $('#eras').querySelectorAll('.echip').forEach(b => b.classList.toggle('on', +b.dataset.e === ei));
};
function pick(force) {
  if (!visible.length) return;
  const mid = focusLine();
  let cur = +visible[0].dataset.i, best = Infinity;
  visible.forEach(el => {
    const b = el.getBoundingClientRect();
    const d = Math.abs((b.top+b.bottom)/2 - mid);
    if (d < best) { best = d; cur = +el.dataset.i; }
  });
  // במובייל הבחירה נעשית בהקשה ולא בגלילה - הגלילה רק מסמנת את התקופה,
  // אחרת היא הייתה דורסת את הפריט שנפתח בגיליון. כשהגיליון פתוח, הסימון
  // נשאר על תקופת הפריט שנפתח.
  if (isNarrow()) {
    if (!document.body.classList.contains('sheet-open')) markEra(cur);
    return;
  }
  if (pinned !== null) cur = pinned;            // בחירה נעוצה גוברת
  else if (scrollY <= 2) cur = +visible[0].dataset.i;  // בראש הדף - הפריט הראשון
  if (cur === active && !force) return;
  active = cur;
  document.querySelectorAll('.card').forEach(el => el.classList.toggle('on', +el.dataset.i === active));
  markEra(active);
  // ההשהיה נועדה בעבר להנפשת ה-fade של המפה הישנה; היא נשארה כדי לא לרנדר
  // מחדש בכל פריים בזמן גלילה מהירה.
  clearTimeout(renderT);
  renderT = setTimeout(render, 120);
}

// ==================== שכבות-על ====================
const overlay = (title, sub, body) => {
  const el = document.createElement('div');
  el.className = 'ov';
  el.innerHTML = `<div class="ovpanel"><button class="ovclose" aria-label="סגירה">✕</button>
    <h2>${title}</h2><p class="osub">${sub}</p>${body}</div>`;
  el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('ovclose')) el.remove(); });
  document.body.appendChild(el);
  return el;
};
const jumpToId = (id) => {
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return false;
  const card = document.querySelector(`.card[data-i="${i}"]`);
  if (!card || card.classList.contains('hidden')) return false;
  document.querySelectorAll('.ov').forEach(o => o.remove());
  // במסך צר הכרטיס הוא גיליון תחתון: מרכוז ברשימה שמאחוריו לא נראה כלל,
  // ולכן פותחים ישירות את הגיליון של היעד
  if (isNarrow()) { centerCard(card); openSheet(i); } else centerCard(card);
  return true;
};

/* מסע מודרך - סיור רציף דמות-אחר-דמות עם שורת הקשר, מאותו tours.json
   של ציר הזמן. קודם הוא היה קיים רק שם, ומבקר שבחר במסע הדורות לא ידע
   בכלל שיש מסעות מודרכים. */
let jt = null;                       // { data, step }
function tourBar() {
  document.querySelector('.jtour')?.remove();
  if (!jt) return;
  const { data, step } = jt, last = step === data.stops.length - 1;
  const el = document.createElement('div');
  el.className = 'tour-bar jtour';
  el.innerHTML = `<button class="tour-x" aria-label="יציאה מהמסע">✕</button>
    <div class="tour-info">
      <div class="tour-title">${data.icon} ${data.title} · <span dir="ltr">${step + 1}/${data.stops.length}</span></div>
      <div class="tour-note">${data.stops[step].note}</div>
    </div>
    <div class="tour-nav">
      <button class="tour-btn" data-d="-1"${step === 0 ? ' disabled' : ''}>הקודם</button>
      <button class="tour-btn tour-next" data-d="${last ? 0 : 1}">${last ? 'סיום ✓' : 'הבא'}</button>
    </div>`;
  el.querySelector('.tour-x').addEventListener('click', endJourney);
  el.querySelectorAll('.tour-btn').forEach((b) => b.addEventListener('click', () => {
    const d = +b.dataset.d;
    if (!d) return endJourney();
    jumpStop(jt.data, jt.step + d);
  }));
  document.body.appendChild(el);
}
function jumpStop(data, step) {
  jt = { data, step };
  tourBar();
  if (!jumpToId(data.stops[step].ref)) toast('התחנה מוסתרת - הפעילו את השכבה המתאימה');
}
function endJourney() { jt = null; tourBar(); }
$('#tTours').addEventListener('click', () => {
  const el = overlay('🧭 מסעות מודרכים', 'סיור דמות-אחר-דמות עם ההקשר המחבר - מתקדמים בקצב שלכם',
    `<div class="ilist">${TOURS.map((t, i) => `<button class="ilrow" data-t="${i}">
      <b>${t.icon} ${t.title}</b><span>${t.stops.length} תחנות</span></button>`).join('')}</div>`);
  el.querySelectorAll('.ilrow').forEach((b) => b.addEventListener('click', () => {
    el.remove();
    jumpStop(TOURS[+b.dataset.t], 0);
  }));
});
/* React נטען רק כשבאמת פותחים את התיבה. ייבוא סטטי היה גורר ~150KB
   לכל מבקר במסך הזה, בשביל כפתור שרוב הגולשים לא ילחצו עליו. */
$('#tNote').addEventListener('click', () => { import('../lib/notes.jsx').then((m) => m.openNotes()); });
$('#betaChip')?.addEventListener('click', () => { import('../lib/notes.jsx').then((m) => m.openNotes()); });

/* פתיחת אוסף תמטי מתגית שבכרטיס. בלי זה התגיות מוצגות אך אינן לחיצות,
   וכל דבר שאפשר לעשות בציר הזמן צריך להיות אפשרי גם כאן. */
function openCollection(c) {
  const rows = c.members.map((id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return '';
    return `<button class="ilrow" data-id="${it.id}">
      <b>${it.name}</b><span>${it.start === it.end ? it.start : `${it.start}–${it.end}`}</span></button>`;
  }).join('');
  const el = overlay(`${c.icon} ${c.title}`, c.subtitle,
    `<div class="icard"><p class="oabout">${c.description}</p></div>
     <div class="icard"><h3>הדמויות באוסף</h3><div class="ilist">${rows}</div></div>`);
  el.querySelectorAll('.ilrow').forEach((b) => b.addEventListener('click', () => {
    if (!jumpToId(b.dataset.id)) toast('הפריט מוסתר - הפעילו את השכבה המתאימה');
  }));
}

$('#tTree').addEventListener('click', () => {
  const node = (n, cls) => `<button class="tnode ${cls}${n.id?' link':''}" ${n.id?`data-id="${n.id}"`:''}>
    <span class="tn">${cls==='sp'?'⚭ ':''}${n.name}</span>${n.role?`<span class="tr">${n.role}</span>`:''}
    ${n.note?`<span class="tr">${n.note}</span>`:''}</button>`;
  const body = '<div class="tflow">' + DATA.genealogy.map((g,i) => {
    const main = node(g.main,'heir') + (g.main.spouses ? `<div class="tsp">${g.main.spouses.map(s=>node(s,'sp')).join('')}</div>` : '');
    const sibs = g.siblings ? `<div class="tsibs">${g.siblings.map(s=>node(s,'sib')).join('')}</div><div class="tconn"></div>` : '';
    return `<div class="tgen">${i>0?'<div class="tconn"></div>':''}${sibs}${main}</div>`;
  }).join('') + '</div>';
  const el = overlay('👑 אילן היוחסין של בית דוד', 'מאברהם אבינו עד מלכי יהודה - לחיצה על שם מודגש קופצת אליו', body);
  el.querySelectorAll('.tnode.link').forEach(b => b.addEventListener('click', () => {
    if (!jumpToId(b.dataset.id)) toast('הפריט מוסתר - הפעילו את השכבה המתאימה');
  }));
});

/* מסך התובנות הוסר לבקשת המשתמש - הסרגל היה עמוס מדי. הנתונים
   ממשיכים להיווצר ב-atlas-data.json, כך שההחזרה היא כפתור ומאזין. */

// אודות ומדריך - שני האייקונים שלצד שם המצב
$('#mAbout').addEventListener('click', () => {
  overlay('ℹ️ אודות הפרויקט', 'נבנה באהבה בידי חובב תנ״ך',
    `<div class="icard"><p class="oabout">הפרויקט נבנה באהבה בידי חובב תנ״ך, מתוך רצון לתרום לקהילה
      ולעזור לכולנו לעשות סדר בתולדות עם ישראל. ייתכנו אי-דיוקים בתאריכים, במפות, במיקומים
      ובפרטים - ואשמח לכל תיקון והערה. שימוש נעים! 📖</p></div>`);
});
$('#mTour').addEventListener('click', () => startTour());

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400);
}
/* אותו shareLink של ציר הזמן: תפריט השיתוף של המערכת רק במכשירי מגע,
   ובדסקטופ העתקה ללוח. navigator.share קיים גם בכרום שולחני, ושם הוא
   נפתח כדיאלוג שנכשל ב-"We couldn't show you all the ways you could share". */
$('#tShare').addEventListener('click', async () => {
  const it = items[active];
  const url = location.origin + '/atlas' + (it ? `?sel=${it.kind}:${it.id}` : '');
  const title = it ? `${it.name} - מסע הדורות` : 'מסע הדורות';
  const res = await shareLink({ url, title });
  if (res === 'copied') toast('הקישור הועתק ✓');
  else if (res === 'failed') toast('העתיקו מהכתובת שלמעלה');
});

build();
