import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Timeline, { LABEL_GUTTER_PX } from './components/Timeline.jsx';
import TimelineVertical from './components/TimelineVertical.jsx';
import DetailCard from './components/DetailCard.jsx';
import MapPanel from './components/MapPanel.jsx';
import SearchBox from './components/SearchBox.jsx';
import FamilyTree from './components/FamilyTree.jsx';
import Intro from './components/Intro.jsx';
import { fetchCommentCounts } from './lib/commentCounts.js';
import { handleAdminParam } from './lib/admin.js';
import leaders from './data/leaders.json';
import judges from './data/judges.json';
import kings from './data/kings.json';
import prophets from './data/prophets.json';
import books from './data/books.json';
import events from './data/events.json';
import periods from './data/periods.json';
import world from './data/world.json';
import empires from './data/empires.json';
import { academicData } from './utils/academic.js';

// ----- מצב באמצעות כתובת ה-URL: מאפשר שיתוף קישור, סימנייה, וכפתור "אחורה" -----
const itemKey = (it) => `${it.kind}:${it.id}`;

function parseUrl() {
  const p = new URLSearchParams(window.location.search);
  const step = p.get('step');
  return {
    sel: p.get('sel'),
    map: p.get('map'),
    step: step != null ? parseInt(step, 10) : null,
    tree: p.get('tree') === '1',
  };
}

function buildUrl({ sel, map, step, tree }) {
  const p = new URLSearchParams();
  if (sel) p.set('sel', sel);
  if (map) {
    p.set('map', map);
    if (step != null && step >= 0) p.set('step', String(step));
  }
  if (tree) p.set('tree', '1');
  const qs = p.toString();
  return window.location.pathname + (qs ? `?${qs}` : '');
}

// טווח הציר לכל מצב (בשנה עברית / שנה עברית-שקולה)
const AXIS = {
  tradition: { start: 1940, end: 3850 },
  academic: { start: 2690, end: 3835 },
};

const PRESETS = {
  tradition: [
    { name: 'הכל', start: 1940, end: 3850 },
    { name: 'האבות', start: 1940, end: 2250 },
    { name: 'מצרים והמדבר', start: 2230, end: 2495 },
    { name: 'התנחלות ושופטים', start: 2488, end: 2890 },
    { name: 'הממלכה המאוחדת', start: 2860, end: 2975 },
    { name: 'יהודה וישראל', start: 2955, end: 3215 },
    { name: 'סוף בית ראשון', start: 3190, end: 3345 },
    { name: 'גלות ושיבת ציון', start: 3320, end: 3460 },
    { name: 'בית שני', start: 3380, end: 3840 },
  ],
  academic: [
    { name: 'הכל', start: 2690, end: 3835 },
    { name: 'הממלכה המאוחדת', start: 2700, end: 2840 },
    { name: 'יהודה וישראל', start: 2825, end: 3045 },
    { name: 'סוף בית ראשון', start: 3020, end: 3180 },
    { name: 'גלות ושיבת ציון', start: 3165, end: 3325 },
    { name: 'בית שני', start: 3235, end: 3835 },
  ],
};

const MIN_PX = 0.4;
const MAX_PX = 20;

// טופס משוב/דיווח (Google Forms)
const FEEDBACK_URL = 'https://forms.gle/PosRsinUJSqd8K3a6';

// ברירת מחדל לשכבות הגלויות (נשמר ב-localStorage בין ביקורים)
const DEFAULT_VISIBLE = { leaders: true, judges: true, kings: true, prophets: true, books: true, events: true, world: true };

// תוויות סוג לכותרת הדף (SEO/שיתוף)
const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך', judah: 'מלך יהודה', israel: 'מלך ישראל',
  prophet: 'נביא', book: 'ספר תנ״ך', event: 'אירוע', world: 'דמות עולמית', empire: 'מלכות',
};
const SITE_TITLE = 'ציר הזמן של עם ישראל';
const SITE_DESC = 'ציר זמן אינטראקטיבי של תולדות עם ישראל — מהאבות ועד חורבן בית שני.';
function setMetaTag(sel, attr, content) {
  let el = document.head.querySelector(`meta[${attr}="${sel}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, sel); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

// כל הפריטים הניתנים-לקישור (מצב מסורת) — לפענוח "kind:id" מהכתובת בלי תלות ב-state
const ALL_ITEMS = [
  ...leaders.map((x) => ({ ...x, kind: 'leader' })),
  ...judges.map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...prophets.map((x) => ({ ...x, kind: 'prophet' })),
  ...books.map((x) => ({ ...x, kind: 'book' })),
  ...world.map((x) => ({ ...x, kind: 'world' })),
  ...events.map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
  ...empires.map((x) => ({ ...x, kind: 'empire' })),
];
function resolveKey(key) {
  if (!key) return null;
  const i = key.indexOf(':');
  if (i < 0) return null;
  const kind = key.slice(0, i), id = key.slice(i + 1);
  return ALL_ITEMS.find((x) => x.kind === kind && x.id === id) || null;
}

export default function App() {
  const scrollRef = useRef(null);
  // מצב התחלתי מהכתובת (?sel=…&map=…&step=…&tree=1) — מאותחל ישירות ב-state כדי למנוע מרוץ
  const initUrl = useRef(null);
  if (initUrl.current === null) initUrl.current = parseUrl();
  const INITIAL = initUrl.current;

  const [pxPerYear, setPxPerYear] = useState(1);
  const [selected, setSelected] = useState(() => resolveKey(INITIAL.sel));
  const [chronology, setChronology] = useState('tradition');
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mapItem, setMapItem] = useState(() => resolveKey(INITIAL.map));
  const [mapStep, setMapStep] = useState(INITIAL.step != null ? INITIAL.step : -1);
  // הפריט שבני-הזמן שלו מודגשים — נשמר בנפרד מהבחירה, כדי שההדגשה תישאר
  // גם אחרי סגירת הכרטיס (חשוב במובייל, שם הכרטיס מסתיר את הציר).
  const [contempItem, setContempItem] = useState(null);
  const [treeOpen, setTreeOpen] = useState(INITIAL.tree);
  const [shareMsg, setShareMsg] = useState('');

  // שיתוף התצוגה הנוכחית: שיתוף מקורי במובייל (וואטסאפ וכו'), אחרת העתקה ללוח
  const shareView = async () => {
    // כשיש פריט נבחר משתפים את דף הפריט (/p/…) ולא את כתובת האפליקציה:
    // רק לו יש תמונת שיתוף ייחודית ותוכן שגוגל/וואטסאפ קוראים בלי JavaScript.
    const url = selected
      ? `${window.location.origin}/p/${selected.kind}/${selected.id}`
      : window.location.href;
    const shareTitle = selected
      ? `${selected.name} — ציר הזמן של עם ישראל`
      : 'ציר הזמן של עם ישראל';
    // שיתוף מקורי רק במכשירי מגע (מובייל/טאבלט) — בדסקטופ הוא מציג דיאלוג שבור, אז מעתיקים ללוח
    const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && navigator.share) {
      try { await navigator.share({ title: shareTitle, url }); } catch { /* בוטל */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('הקישור הועתק ✓');
    } catch {
      setShareMsg('העתיקו מהכתובת שלמעלה');
    }
    setTimeout(() => setShareMsg(''), 2200);
  };
  // ניהול היסטוריית הדפדפן: popping = שינוי שהגיע מכפתור "אחורה";
  // overlayPushed = כמה חלוניות דחפנו להיסטוריה (כדי לדעת אם "סגירה" יכולה לחזור אחורה)
  const popping = useRef(false);
  const overlayPushed = useRef(0);
  const prevOverlay = useRef({ map: INITIAL.map || null, tree: INITIAL.tree });
  const [visible, setVisible] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('si_visible'));
      if (saved && typeof saved === 'object') return { ...DEFAULT_VISIBLE, ...saved };
    } catch { /* אין שמירה */ }
    return DEFAULT_VISIBLE;
  });
  // שמירת בחירת השכבות בין ביקורים
  useEffect(() => {
    try { localStorage.setItem('si_visible', JSON.stringify(visible)); } catch { /* מתעלמים */ }
  }, [visible]);

  // ציר אנכי ("זרם כרונולוגי") — ברירת מחדל במובייל, ונשמר בין ביקורים
  const [vertical, setVertical] = useState(() => {
    try {
      const saved = localStorage.getItem('si_vertical');
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch { /* אין שמירה */ }
    return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 680px)').matches;
  });
  useEffect(() => {
    try { localStorage.setItem('si_vertical', vertical ? '1' : '0'); } catch { /* מתעלמים */ }
  }, [vertical]);

  // כניסה/יציאה ממצב ניהול דרך ?admin=1
  useEffect(() => { handleAdminParam(); }, []);

  // מונה תגובות לכל פריט — כדי לסמן על הציר היכן כבר יש דיון
  const [commentCounts, setCommentCounts] = useState({});
  useEffect(() => {
    let alive = true;
    fetchCommentCounts().then((c) => { if (alive) setCommentCounts(c); });
    return () => { alive = false; };
  }, []);

  // מדריך היכרות — נפתח מעצמו בביקור הראשון בלבד
  const [introOpen, setIntroOpen] = useState(() => {
    try { return !localStorage.getItem('si_seen_intro'); } catch { return false; }
  });
  const closeIntro = () => {
    setIntroOpen(false);
    try { localStorage.setItem('si_seen_intro', '1'); } catch { /* מתעלמים */ }
  };

  const axis = AXIS[chronology];
  const data = chronology === 'academic'
    ? academicData
    : { leaders, judges, kings, prophets, books, events, periods, world };

  // טווח ההדגשה למצב "בני-הזמן" — תקופת החיים/כהונה של פריט העוגן
  const highlightRange = contempItem
    ? { start: contempItem.start, end: contempItem.end }
    : null;

  // בחירת פריט אחר מבטלת הדגשת בני-זמן קודמת; סגירת הכרטיס (selected=null) לא.
  useEffect(() => {
    setContempItem((prev) =>
      prev && selected && itemKey(selected) !== itemKey(prev) ? null : prev
    );
  }, [selected]);

  // עדכון כותרת הדף, התיאור וה-canonical לפי הפריט הנבחר (SEO + תצוגת שיתוף)
  useEffect(() => {
    const canon = document.head.querySelector('link[rel="canonical"]');
    if (selected) {
      const label = KIND_LABELS[selected.kind];
      const title = `${selected.name}${label ? ' — ' + label : ''} | ${SITE_TITLE}`;
      const desc = String(selected.description || selected.name).replace(/\s+/g, ' ').trim().slice(0, 155);
      document.title = title;
      setMetaTag('description', 'name', desc);
      setMetaTag('og:title', 'property', title);
      setMetaTag('og:description', 'property', desc);
      setMetaTag('og:url', 'property', `${location.origin}/?sel=${selected.kind}:${selected.id}`);
      // ה-canonical מפנה לדף-הנחיתה הסטטי של הפריט (איחוד אותות SEO)
      if (canon) canon.setAttribute('href', `${location.origin}/p/${selected.kind}/${selected.id}`);
    } else {
      document.title = SITE_TITLE;
      setMetaTag('description', 'name', SITE_DESC);
      setMetaTag('og:title', 'property', SITE_TITLE);
      setMetaTag('og:description', 'property', SITE_DESC);
      setMetaTag('og:url', 'property', `${location.origin}/`);
      if (canon) canon.setAttribute('href', `${location.origin}/`);
    }
  }, [selected]);

  // אינדקס חיפוש — כל הפריטים הנבחרים מכל הרצועות (ללא תקופות שאינן נבחרות)
  const searchIndex = useMemo(() => {
    const idx = [];
    const add = (arr, kind) => (arr || []).forEach((it) => idx.push({ ...it, kind }));
    add(data.leaders, 'leader');
    add(data.judges, 'judge');
    add(data.kings.united, 'united');
    add(data.kings.judah, 'judah');
    add(data.kings.israel, 'israel');
    add(data.prophets, 'prophet');
    add(data.books, 'book');
    add(data.world, 'world');
    (data.events || []).forEach((ev) => idx.push({ ...ev, kind: 'event', start: ev.year, end: ev.year }));
    return idx;
  }, [chronology]);

  // קפיצה לפריט מהחיפוש: הדלקת השכבה, בחירה, וגלילה למרכז המסך
  const LAYER_OF = {
    leader: 'leaders', judge: 'judges', united: 'kings', judah: 'kings',
    israel: 'kings', prophet: 'prophets', book: 'books', event: 'events', world: 'world',
  };
  const jumpTo = (item) => {
    const layer = LAYER_OF[item.kind];
    if (layer) setVisible((v) => (v[layer] ? v : { ...v, [layer]: true }));
    setSelected(item);
    if (vertical) { scrollToItem(item); return; }
    const el = scrollRef.current;
    const midYear = (item.start + item.end) / 2;
    scrollToYear(midYear, centerOffset(el), pxPerYear);
  };

  // קפיצה מאילן היוחסין: בחירה, הדלקת בני-הזמן, וזום-אין אל הדמות והקשרה.
  // אב/דמות שקיימת רק במסורת — נעבור למצב מסורת.
  const jumpToId = (id) => {
    const item = searchIndex.find((x) => x.id === id);
    if (!item) { if (chronology === 'academic') setChronology('tradition'); return; }
    // סגירת האילן ישירות (לא דרך "אחורה", שהיה מנקה את הבחירה) — אנחנו מנווטים לתצוגה חדשה
    setTreeOpen(false);
    overlayPushed.current = Math.max(0, overlayPushed.current - 1);
    prevOverlay.current = { map: null, tree: false };
    const layer = LAYER_OF[item.kind];
    if (layer) setVisible((v) => (v[layer] ? v : { ...v, [layer]: true }));
    setSelected(item);
    setContempItem(item); // הדגשת בני-הזמן
    if (vertical) { scrollToItem(item); return; }
    // זום-אין כך שתקופת החיים תתפוס כשליש מהרוחב — רואים את הדמות ואת מי שחי במקביל
    const el = scrollRef.current;
    const span = Math.max(item.end - item.start, 20);
    const view = el ? (vertical ? el.clientHeight : el.clientWidth) - 40 : 800;
    const targetPx = Math.min(MAX_PX, Math.max(getMinPx(), view / (span * 3)));
    scrollToYear((item.start + item.end) / 2, centerOffset(el), targetPx);
  };

  // החלת מצב מהכתובת (בלחיצה על "אחורה")
  const applyUrl = (u, px) => {
    const selItem = resolveKey(u.sel);
    setTreeOpen(!!u.tree);
    setMapItem(resolveKey(u.map));
    setMapStep(u.step != null ? u.step : -1);
    setSelected(selItem);
    prevOverlay.current = { map: u.map || null, tree: !!u.tree };
    if (selItem) {
      if (vertical) { scrollToItem(selItem); return; }
      const el = scrollRef.current;
      scrollToYear((selItem.start + selItem.end) / 2, centerOffset(el), px ?? pxPerYear);
    }
  };

  // סנכרון המצב אל הכתובת. פתיחת חלונית (מפה/אילן) דוחפת רשומת היסטוריה,
  // כך ש"אחורה" סוגר אותה; שאר השינויים רק מחליפים את הכתובת.
  useEffect(() => {
    if (popping.current) {
      popping.current = false;
      prevOverlay.current = { map: mapItem && itemKey(mapItem), tree: treeOpen };
      return;
    }
    const map = mapItem ? itemKey(mapItem) : null;
    const url = buildUrl({ sel: selected ? itemKey(selected) : null, map, step: mapStep, tree: treeOpen });
    // פתיחת חלונית (מפה/אילן) דוחפת רשומת היסטוריה כדי ש"אחורה" יסגור אותה; שאר השינויים מחליפים בלבד
    const opened = (map && map !== prevOverlay.current.map) || (treeOpen && !prevOverlay.current.tree);
    if (opened) { window.history.pushState({}, '', url); overlayPushed.current += 1; }
    else window.history.replaceState({}, '', url);
    prevOverlay.current = { map, tree: treeOpen };
  }, [selected, mapItem, mapStep, treeOpen]);

  // כפתור "אחורה" של הדפדפן
  useEffect(() => {
    const onPop = () => {
      popping.current = true;
      overlayPushed.current = Math.max(0, overlayPushed.current - 1);
      applyUrl(parseUrl());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  // סגירת חלונית: אם דחפנו רשומה — נחזור אחורה (כדי לא לנפח היסטוריה); אחרת נסגור ישירות
  const closeOverlay = (fallback) => {
    if (overlayPushed.current > 0) window.history.back();
    else fallback();
  };

  // רשימת הפריטים באותה קטגוריה של הנבחר (מלכי המאוחדת+יהודה נספרים כרצף אחד)
  const categoryList = (item) => {
    const tag = (arr, kind) => (arr || []).map((x) => ({ ...x, kind }));
    switch (item.kind) {
      case 'leader': return tag(data.leaders, 'leader');
      case 'judge': return tag(data.judges, 'judge');
      case 'united':
      case 'judah': return [...tag(data.kings.united, 'united'), ...tag(data.kings.judah, 'judah')];
      case 'israel': return tag(data.kings.israel, 'israel');
      case 'prophet': return tag(data.prophets, 'prophet');
      case 'book': return tag(data.books, 'book');
      case 'world': return tag(data.world, 'world');
      case 'event': return (data.events || []).map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year }));
      default: return [];
    }
  };

  // שכנים בזמן: הקודם = מוקדם יותר, הבא = מאוחר יותר
  let prevItem = null, nextItem = null;
  if (selected) {
    const list = categoryList(selected).sort((a, b) => a.start - b.start || a.end - b.end);
    const i = list.findIndex((x) => x.id === selected.id);
    if (i > 0) prevItem = list[i - 1];
    if (i !== -1 && i < list.length - 1) nextItem = list[i + 1];
  }

  // רצועת התוויות צרה יותר במובייל (מסך צר) מאשר בדסקטופ
  const gutter = (typeof window !== 'undefined' && window.innerWidth <= 680) ? 130 : LABEL_GUTTER_PX;

  // הזום המינימלי: כל הציר (כולל רצועת התוויות בימין) בדיוק ברוחב החלון
  const getMinPx = () => {
    const el = scrollRef.current;
    // בציר האנכי הגלילה טבעית — אין צורך לדחוס את כל הטווח לגובה המסך
    if (vertical) return MIN_PX;
    return el ? Math.max(MIN_PX, (el.clientWidth - 40 - gutter) / (axis.end - axis.start)) : MIN_PX;
  };

  // זום פתיחה לכל מצב: אופקי — כל הציר על המסך; אנכי — צפיפות נוחה לגלילה
  const VERTICAL_DEFAULT_PX = 2.5;
  const openingPx = () => (vertical ? VERTICAL_DEFAULT_PX : getMinPx());

  // תצוגת פתיחה; ובשינוי גודל חלון — לא להישאר קטן מהמסך
  useEffect(() => {
    const px = openingPx();
    setPxPerYear(px);
    // אם נטענו מכתובת משותפת עם דמות נבחרת — לגלול אליה במקום לקצה
    if (selected) {
      scrollRightPending.current = false;
      if (vertical) scrollToItem(selected);
      else scrollToYear((selected.start + selected.end) / 2, centerOffset(scrollRef.current), px);
    }
    const onResize = () => setPxPerYear((p) => Math.max(p, getMinPx()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // החלפת כיוון הציר — התאמת הזום ומיקום הגלילה למצב החדש
  const prevVertical = useRef(vertical);
  useEffect(() => {
    if (prevVertical.current === vertical) return;
    prevVertical.current = vertical;
    setPxPerYear(vertical ? VERTICAL_DEFAULT_PX : getMinPx());
  }, [vertical]);

  // בהחלפת מצב כרונולוגיה בפועל — איפוס לתצוגה מלאה, פתיחה בצד ימין (העבר), וניקוי הבחירה.
  // משווים לערך הקודם (ולא לדגל mount) כדי שלא ננקה מצב ששוחזר מכתובת — עמיד גם ל-StrictMode.
  const prevChrono = useRef(chronology);
  useEffect(() => {
    if (prevChrono.current === chronology) return;
    prevChrono.current = chronology;
    setSelected(null); setMapItem(null); setTreeOpen(false); setContempItem(null);
    scrollRightPending.current = true;
    setPxPerYear(getMinPx());
  }, [chronology]);

  // גלילה ממתינה: מוחלת רק אחרי שהקנבס צויר מחדש ברוחב החדש (useLayoutEffect)
  const pendingScroll = useRef(null);
  // בטעינה/החלפת מצב — לפתוח בקצה הימני (הזמן הקדום ביותר)
  const scrollRightPending = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollRightPending.current) {
      scrollRightPending.current = false;
      pendingScroll.current = null;
      // אופקי: הקצה הימני = תחילת הציר (העבר). אנכי: הקצה העליון הוא כבר העבר.
      if (vertical) el.scrollTop = 0; else el.scrollLeft = el.scrollWidth;
      return;
    }
    if (!pendingScroll.current) return;
    const { year, offset } = pendingScroll.current;
    pendingScroll.current = null;
    if (vertical) el.scrollTop = (year - axis.start) * pxPerYear - offset;
    else el.scrollLeft = (axis.end - year) * pxPerYear - offset;
  }, [pxPerYear, chronology, vertical]);

  // מרכז המסך בציר הרלוונטי (רוחב באופקי, גובה באנכי)
  const centerOffset = (el) => (el ? (vertical ? el.clientHeight : el.clientWidth) / 2 : 0);

  // בזרם האנכי המיקום אינו פרופורציונלי לשנה — גוללים אל השורה עצמה
  const scrollToItem = (it) => {
    const el = scrollRef.current;
    if (!el || !it) return;
    requestAnimationFrame(() => {
      const node = el.querySelector(`[data-key="${it.kind}:${it.id}"]`);
      if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const scrollToYear = (year, offset, px) => {
    const el = scrollRef.current;
    if (!el) return;
    if (px === pxPerYear) {
      if (vertical) el.scrollTop = (year - axis.start) * px - offset;
      else el.scrollLeft = (axis.end - year) * px - offset;
    } else {
      pendingScroll.current = { year, offset };
      setPxPerYear(px);
    }
  };

  const goTo = (preset) => {
    const el = scrollRef.current;
    if (!el) return;
    if (vertical) {
      // גלילה אל הפריט הראשון בטווח המבוקש
      const first = searchIndex
        .filter((x) => x.end >= preset.start && x.start <= preset.end)
        .sort((a, b) => a.start - b.start)[0];
      if (first) scrollToItem(first); else el.scrollTop = 0;
      return;
    }
    const px = Math.min(MAX_PX, Math.max(getMinPx(), (el.clientWidth - 40) / (preset.end - preset.start)));
    scrollToYear(preset.end, 20, px);
  };

  const zoom = (factor, anchorX) => {
    const el = scrollRef.current;
    if (!el) return;
    const px = Math.min(MAX_PX, Math.max(getMinPx(), pxPerYear * factor));
    if (vertical) {
      const offset = el.clientHeight / 2;
      const yearAtAnchor = axis.start + (el.scrollTop + offset) / pxPerYear;
      scrollToYear(yearAtAnchor, offset, px);
      return;
    }
    const offset = anchorX ?? el.clientWidth / 2;
    const yearAtAnchor = axis.end - (el.scrollLeft + offset) / pxPerYear;
    scrollToYear(yearAtAnchor, offset, px);
  };

  // זום בגלגלת עם Ctrl
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  // זום בצביטה (pinch) בשתי אצבעות במובייל
  const pinch = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e) => {
      if (e.touches.length === 2) {
        const rect = el.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        pinch.current = {
          startDist: dist(e.touches), startPx: pxPerYear, midX,
          yearAtAnchor: axis.end - (el.scrollLeft + midX) / pxPerYear,
        };
      }
    };
    const onMove = (e) => {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        // הגברת רגישות הצביטה — תנועת אצבעות קטנה נותנת שינוי זום גדול יותר
        const scale = Math.pow(dist(e.touches) / pinch.current.startDist, 1.8);
        const px = Math.min(MAX_PX, Math.max(getMinPx(), pinch.current.startPx * scale));
        scrollToYear(pinch.current.yearAtAnchor, pinch.current.midX, px);
      }
    };
    const onEnd = (e) => { if (e.touches.length < 2) pinch.current = null; };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  });

  const toggle = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));
  const isAcademic = chronology === 'academic';

  return (
    <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <header>
        <div className="header-top">
          <div className="title-block">
            <div className="title-row">
              <h1>ציר הזמן של עם ישראל</h1>
              <button className="about-btn" onClick={() => setAboutOpen(true)} title="אודות" aria-label="אודות">i</button>
              <button
                className="about-btn guide-btn"
                onClick={() => setIntroOpen(true)}
                title="מדריך היכרות — מה אפשר לעשות כאן"
                aria-label="מדריך היכרות"
              >?</button>
            </div>
            <span className="subtitle">
              {isAcademic
                ? 'מהמלוכה עד חורבן בית שני · לפי הכרונולוגיה המחקרית'
                : 'מהאבות עד חורבן בית שני · לפי המסורת (סדר עולם)'}
            </span>
          </div>
          <button
            className="menu-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >{menuOpen ? '✕ סגירה' : '☰ אפשרויות'}</button>
        </div>
        <div className="search-row">
          <SearchBox index={searchIndex} onPick={jumpTo} />
          <button className="tree-btn" onClick={() => setTreeOpen(true)}>
            <span aria-hidden="true">👑</span> אילן יוחסין
          </button>
          <button
            className="share-btn"
            onClick={shareView}
            title={selected ? `שיתוף הדף של ${selected.name}` : 'שיתוף התצוגה הנוכחית'}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
            </svg>
            שיתוף
          </button>
          <button
            className="orient-btn"
            onClick={() => { setVertical((v) => !v); scrollRightPending.current = true; }}
            title={vertical ? 'מעבר לציר אופקי' : 'מעבר לציר אנכי (נוח לגלילה בטלפון)'}
          >
            <span aria-hidden="true">{vertical ? '↔' : '↕'}</span>
            {vertical ? 'ציר אופקי' : 'ציר אנכי'}
          </button>
          {shareMsg && <span className="share-msg">{shareMsg}</span>}
        </div>
        <div className={`controls${menuOpen ? ' open' : ''}`}>
          <div className="ctrl-stack">
            <div className="ctrl-group">
              <span className="ctrl-label">טווח</span>
              <div className="presets">
                {PRESETS[chronology].map((p) => (
                  <button key={p.name} onClick={() => { goTo(p); setMenuOpen(false); }}>{p.name}</button>
                ))}
              </div>
            </div>
            <div className="ctrl-group">
              <span className="ctrl-label">שכבות</span>
              <div className="toggles">
                {!isAcademic && <label><input type="checkbox" checked={visible.leaders} onChange={() => toggle('leaders')} /> אבות ומנהיגים</label>}
                {!isAcademic && <label><input type="checkbox" checked={visible.judges} onChange={() => toggle('judges')} /> שופטים</label>}
                <label><input type="checkbox" checked={visible.kings} onChange={() => toggle('kings')} /> מלכים</label>
                <label><input type="checkbox" checked={visible.prophets} onChange={() => toggle('prophets')} /> נביאים</label>
                <label><input type="checkbox" checked={visible.books} onChange={() => toggle('books')} /> ספרים</label>
                <label><input type="checkbox" checked={visible.events} onChange={() => toggle('events')} /> אירועים</label>
                <label><input type="checkbox" checked={visible.world} onChange={() => toggle('world')} /> רקע עולמי</label>
              </div>
            </div>
          </div>
          {!vertical && (
            <div className="zoom-btns">
              <button onClick={() => zoom(1.4)} aria-label="התקרבות" title="התקרבות">+</button>
              <button onClick={() => zoom(0.7)} aria-label="התרחקות" title="התרחקות">−</button>
            </div>
          )}
        </div>
      </header>

      <div className="legend">
        {!isAcademic && <span className="lg leader">אבות ומנהיגים</span>}
        {!isAcademic && <span className="lg judge">שופטים</span>}
        <span className="lg united">ממלכה מאוחדת</span>
        <span className="lg judah">יהודה</span>
        <span className="lg israel">ישראל</span>
        <span className="lg prophet">נביאים</span>
        <span className="lg book">ספרים</span>
        <span className="lg world">רקע עולמי</span>
        <span className="lg event-lg">◆ אירועים</span>
        <span className="lg-sep">|</span>
        <span className="lg dot-lg"><span className="dot good" /> הישר בעיני ה'</span>
        <span className="lg dot-lg"><span className="dot bad" /> הרע בעיני ה'</span>
        <span className="lg dot-lg"><span className="dot mixed" /> מעורב</span>
      </div>

      {isAcademic && (
        <div className="academic-note">
          במצב זה מוצגות רק תקופות שלהן תיארוך מחקרי מבוסס (מהמלוכה ואילך, מלכים לפי כרונולוגיית Thiele).
          תקופת האבות, יציאת מצרים והשופטים אינה מתוארכת בהסכמה מחקרית — ולכן אינה מוצגת כאן. ייתכנו הפרשים של שנים ספורות בין חוקרים.
        </div>
      )}

      {vertical ? (
        <div className="vtl-wrap" ref={scrollRef}>
          <TimelineVertical
            pxPerYear={pxPerYear}
            startYear={axis.start} endYear={axis.end} mode={chronology}
            periods={data.periods} leaders={data.leaders} judges={data.judges} kings={data.kings}
            prophets={data.prophets} books={data.books} events={data.events} world={data.world}
            visible={visible} selected={selected} onSelect={setSelected}
            highlightRange={highlightRange} commentCounts={commentCounts}
          />
        </div>
      ) : (
        <div className="scroll-area" ref={scrollRef} dir="ltr">
          <Timeline
            pxPerYear={pxPerYear} gutter={gutter}
            startYear={axis.start} endYear={axis.end} mode={chronology}
            periods={data.periods} leaders={data.leaders} judges={data.judges} kings={data.kings}
            prophets={data.prophets} books={data.books} events={data.events} world={data.world}
            visible={visible} selected={selected} onSelect={setSelected}
            highlightRange={highlightRange} commentCounts={commentCounts}
          />
        </div>
      )}

      {!selected && !vertical && (
        <div className="fab-zoom">
          <button onClick={() => zoom(1.4)} aria-label="התקרבות">+</button>
          <button onClick={() => zoom(0.7)} aria-label="התרחקות">−</button>
        </div>
      )}

      {contempItem && !selected && (
        <button className="contemp-clear" onClick={() => setContempItem(null)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
          בני-הזמן של {contempItem.name}
          <span className="cc-x" aria-hidden="true">✕</span>
        </button>
      )}

      <DetailCard
        item={selected} mode={chronology}
        onClose={() => setSelected(null)}
        onOpenMap={(it) => { setMapStep(-1); setMapItem(it); }}
        contemporariesOn={!!(selected && contempItem && itemKey(selected) === itemKey(contempItem))}
        onToggleContemporaries={() =>
          setContempItem((prev) =>
            prev && selected && itemKey(prev) === itemKey(selected) ? null : selected
          )
        }
        prevItem={prevItem} nextItem={nextItem} onNav={jumpTo}
      />

      <MapPanel
        item={mapItem} onClose={() => closeOverlay(() => setMapItem(null))}
        initialStep={mapStep} onStep={setMapStep}
      />

      <FamilyTree open={treeOpen} onClose={() => closeOverlay(() => setTreeOpen(false))} onJump={jumpToId} />

      <footer>
        הזמן זורם מימין (עבר) לשמאל · Ctrl+גלגלת לזום ·{' '}
        {isAcademic
          ? 'התאריכים לפי המחקר ההיסטורי המקובל'
          : 'התאריכים משוערים לפי המסורת; ייתכנו חפיפות בין מלכים (מלוכה משותפת)'}
        {' · '}
        <a className="footer-feedback" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">💬 משוב ודיווח</a>
        {' · '}
        <a className="footer-feedback" href="/p/">מפת האתר</a>
      </footer>

      {aboutOpen && (
        <div className="about-overlay" onClick={() => setAboutOpen(false)}>
          <div className="about-card" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setAboutOpen(false)} aria-label="סגירה">✕</button>
            <h3>אודות הפרויקט</h3>
            <p>
              הפרויקט נבנה באהבה בידי חובב תנ״ך, מתוך רצון לתרום לקהילה ולעזור לכולנו
              לעשות סדר בתולדות עם ישראל. ייתכנו אי-דיוקים בתאריכים, במפות, במיקומים
              ובפרטים — ואשמח לכל תיקון והערה. שימוש נעים! 📖
            </p>
            <a className="feedback-btn" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
              💬 משוב · דיווח על תקלה · הצעת תיקון
            </a>
          </div>
        </div>
      )}

      <Intro open={introOpen} onClose={closeIntro} visible={visible} setVisible={setVisible} />
    </div>
  );
}
