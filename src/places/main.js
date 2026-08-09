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
const LABEL_MIN = 4;

function drawMap() {
  const marks = [...PLACES]
    // הגדולים נצבעים ראשונים ולכן יושבים מתחת: כך נקודה קטנה וסמוכה
    // (בית לחם ליד ירושלים) נשארת גלויה וניתנת ללחיצה
    .sort((a, b) => b.visits.length - a.visits.length)
    .map((p) => {
      const r = RAD(p.visits.length);
      const label = p.visits.length >= LABEL_MIN
        ? `<text x="${p.x}" y="${(p.y - r - 7).toFixed(1)}" text-anchor="middle" font-size="21">${esc(p.name)}</text>` : '';
      return `<g class="pm" data-id="${esc(p.id)}" role="button" tabindex="0"
        aria-label="${esc(p.name)} - ${p.visits.length} ביקורים">
        <title>${esc(p.name)} · ${p.visits.length} ביקורים</title>
        <circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(1)}"/>${label}</g>`;
    }).join('');
  $('#map').innerHTML =
    `<image href="${MAP_SRC}" x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}"/>
     ${marks}
     <g id="cog" hidden><circle cx="0" cy="0" r="30"/><text x="0" y="-40" text-anchor="middle" font-size="20">מרכז הכובד</text></g>`;
  $('#map').querySelectorAll('.pm').forEach((g) => {
    g.addEventListener('click', () => select(g.dataset.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.dataset.id); }
    });
  });
}

/* מרכז הכובד: ממוצע מיקומי הביקורים בתקופה. זו התשובה החזותית לשאלה
   "איפה ההיסטוריה מתרחשת עכשיו" - הוא נודד דרומה עם ירידת ממלכת ישראל. */
function paintCog() {
  const g = $('#cog');
  if (!era) { g.setAttribute('hidden', ''); return; }
  let sx = 0, sy = 0, n = 0;
  for (const p of PLACES) for (const v of p.visits) {
    if (v.year >= era.start && v.year < era.end) { sx += p.x; sy += p.y; n++; }
  }
  if (!n) { g.setAttribute('hidden', ''); return; }
  const cx = sx / n, cy = sy / n;
  g.removeAttribute('hidden');
  g.querySelector('circle').setAttribute('cx', cx.toFixed(1));
  g.querySelector('circle').setAttribute('cy', cy.toFixed(1));
  g.querySelector('text').setAttribute('x', cx.toFixed(1));
  g.querySelector('text').setAttribute('y', (cy - 40).toFixed(1));
}

function paintMarks() {
  const shown = new Set(filtered().map((p) => p.id));
  $('#map').querySelectorAll('.pm').forEach((g) => {
    g.classList.toggle('off', !shown.has(g.dataset.id));
    g.classList.toggle('on', g.dataset.id === sel);
  });
  paintCog();
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
  era = e;
  renderEras(); renderList(); paintMarks();
}

// ==================== פירוט מקום ====================
function renderDetail(p) {
  const range = p.from === p.to ? `שנת ${p.from}` : `${p.from}–${p.to} לבריאה`;
  $('#detail').innerHTML = `
    <button class="dback" id="dBack">→ חזרה לרשימה</button>
    <h2>${esc(p.name)}</h2>
    <p class="dsub">${p.visits.length} ביקורים · ${esc(range)}</p>
    ${p.aka.length ? `<p class="daka">נקרא גם: ${p.aka.map(esc).join(' · ')}</p>` : ''}
    <ul class="dvisits">${p.visits.map((v) => `
      <li class="dv" style="--kc:${KIND_COLOR[v.kind] || 'var(--navy)'}">
        <div class="dvhead">
          <a class="dvname" href="/atlas?sel=${esc(v.kind)}:${esc(v.id)}">${esc(v.name)}</a>
          <span class="dvyear">${esc(KIND_LABEL[v.kind] || '')} · ${v.year}</span>
        </div>
        ${v.label ? `<p class="dvlabel">${esc(v.label)}</p>` : ''}
        ${v.desc ? `<p class="dvdesc">${esc(v.desc)}</p>` : ''}
        <a class="dvgo" href="/atlas?sel=${esc(v.kind)}:${esc(v.id)}">למסע של ${esc(v.name)} ←</a>
      </li>`).join('')}</ul>`;
  $('#dBack').addEventListener('click', () => select(null));
}

function select(id, replace = false) {
  sel = id && id !== sel ? id : (id || null);
  const p = sel ? PLACES.find((x) => x.id === sel) : null;
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
  renderList();
  paintMarks();
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
openFromUrl();

$('#q').addEventListener('input', (e) => {
  query = e.target.value;
  if (sel) select(null);
  renderList(); paintMarks();
});
addEventListener('popstate', () => openFromUrl(true));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { stopPlay(); if (sel) select(null); }
});
$('#tShare').addEventListener('click', async () => {
  const url = location.origin + '/places' + (sel ? `?p=${encodeURIComponent(sel)}` : '');
  const title = sel ? `${sel} - מפת המקומות` : 'מפת המקומות';
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url); toast('הקישור הועתק ✓');
  } catch { toast('העתיקו מהכתובת שלמעלה'); }
});
