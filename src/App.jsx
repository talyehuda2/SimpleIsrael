import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Timeline, { LABEL_GUTTER_PX } from './components/Timeline.jsx';
import TimelineVertical from './components/TimelineVertical.jsx';
import DetailCard from './components/DetailCard.jsx';
import JourneyMap from './components/JourneyMap.jsx';
import SearchBox from './components/SearchBox.jsx';
import FamilyTree from './components/FamilyTree.jsx';
import Intro from './components/Intro.jsx';
import NotesBox from './components/NotesBox.jsx';
import AskBox from './components/AskBox.jsx';
import { fetchCommentCounts } from './lib/commentCounts.js';
import { handleAdminParam, getAdminToken } from './lib/admin.js';
import { shareLink } from './lib/share.js';
import { mark, markOnce } from './lib/trail.js';
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
import maps from './data/maps.json';
import tours from './data/tours.json';
import collections from './data/collections.json';
import { buildPlaceIndex, relatedByEra, relatedByPlace } from './utils/related.js';

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
    // ?contemp=1 - נחיתה עם בני-הזמן כבר מודגשים. כך "הצג על ציר הזמן"
    // ממסע הדורות מגיע ישר לתשובה שהמבט הזה טוב בה: מי חי לצד מי.
    contemp: p.get('contemp') === '1',
    // ?comments=1 - נחיתה עם התגובות פתוחות. מסע הדורות אינו טוען את
    // Supabase, ולכן כפתור התגובות שם מקשר לכאן.
    comments: p.get('comments') === '1',
    // ?era / ?coll - שער הכניסה בדפי-הנחיתה (/p/period, /p/collection)
    // שולח לכאן, וכדי שהמעבר יהיה רציף הציר נפתח כבר על אותה תקופה
    // או עם אותו אוסף פתוח, ולא בתצוגת ברירת המחדל.
    era: p.get('era'),
    coll: p.get('coll'),
  };
}

function buildUrl({ sel, map, step, tree, contemp }) {
  const p = new URLSearchParams();
  if (sel) p.set('sel', sel);
  if (map) {
    p.set('map', map);
    if (step != null && step >= 0) p.set('step', String(step));
  }
  if (tree) p.set('tree', '1');
  if (contemp) p.set('contemp', '1');
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

/* חלון הפתיחה בציר האופקי, נבחר לפי צפיפות ולא לפי מיקום ברשימת הפריסטים.
   קודם נפתחנו על PRESETS[1] - "האבות" - שהוא החלון הדליל ביותר באתר:
   14 פריטים על פני 310 שנה, 4.5 ל-100 שנה, בעוד שאר התקופות צפופות פי
   חמישה. המסך הראשון יצא גם מקורב וגם ריק. החלון כאן מחזיק 72 פריטים
   (20.3 ל-100 שנה) והוא רק 45 שנה רחב יותר, כלומר הזום כמעט לא משתנה:
   מתחיל בדוד ובשלמה - השמות שכל אחד מזהה - וזורם משם לפילוג ולשתי
   הממלכות במקביל, שהיא התכונה החזותית הייחודית של הציר. */
const OPENING = {
  tradition: { start: 2860, end: 3215 },
  academic: { start: 2700, end: 3045 },
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
const SITE_DESC = 'ציר זמן אינטראקטיבי של תולדות עם ישראל - מהאבות ועד חורבן בית שני.';
function setMetaTag(sel, attr, content) {
  let el = document.head.querySelector(`meta[${attr}="${sel}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, sel); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

// כל הפריטים הניתנים-לקישור (מצב מסורת) - לפענוח "kind:id" מהכתובת בלי תלות ב-state
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
  // מצב התחלתי מהכתובת (?sel=…&map=…&step=…&tree=1) - מאותחל ישירות ב-state כדי למנוע מרוץ
  const initUrl = useRef(null);
  if (initUrl.current === null) initUrl.current = parseUrl();
  const INITIAL = initUrl.current;

  // זום התחלתי משוער לתקופת הפתיחה (האבות) - כך ה-commit הראשון כבר מצויר
  // ברוחב הנכון, והגלילה-לקצה-הימני נוחתת בדיוק על התקופה. מדויק סופית באפקט הפתיחה.
  const [pxPerYear, setPxPerYear] = useState(() => {
    const first = PRESETS.tradition[1];
    return Math.min(MAX_PX, Math.max(MIN_PX, (window.innerWidth - 60) / (first.end - first.start)));
  });
  const [selected, setSelected] = useState(() => resolveKey(INITIAL.sel));
  const [chronology, setChronology] = useState('tradition');
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  /* סוכן השאלות בשלב בדיקה - הכפתור מופיע רק למי שיש לו טוקן ניהול.
     זו הסתרה בממשק בלבד; האכיפה האמיתית היא ב-/api/ask שמאמת את הטוקן. */
  const [isAdmin, setIsAdmin] = useState(false);
  const [mapItem, setMapItem] = useState(() => resolveKey(INITIAL.map));
  const [mapStep, setMapStep] = useState(INITIAL.step != null ? INITIAL.step : -1);
  // הפריט שבני-הזמן שלו מודגשים - נשמר בנפרד מהבחירה, כדי שההדגשה תישאר
  // גם אחרי סגירת הכרטיס (חשוב במובייל, שם הכרטיס מסתיר את הציר).
  const [contempItem, setContempItem] = useState(() => (INITIAL.contemp ? resolveKey(INITIAL.sel) : null));
  const [mapMin, setMapMin] = useState(false); // מפת המסע ממוזערת לרצועה? (דסקטופ)
  const [mapOpen, setMapOpen] = useState(false); // מפת המסע כשכבה מלאה (מובייל)
  // במובייל המפה אינה מעוגנת לצד הכרטיס (זה מחלק את המסך לשניים) אלא נפתחת לפי דרישה
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 680px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    window.addEventListener('resize', on); // גיבוי - לא כל דפדפן משגר change על שינוי גודל
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);
  // במסע מודרך הגיליון נפתח חצי - כדי שהציר ושורת המסע יישארו גלויים
  useEffect(() => { setMapOpen(false); setSheetPos(tourActiveRef.current ? 'half' : 'full'); }, [selected]);
  // מובייל: הכרטיס כ"גיליון תחתון" - נפתח מלא (אינטואיטיבי); גרירה מטה מקטינה/סוגרת
  const [sheetPos, setSheetPos] = useState('full');
  const sheetTouchY = useRef(null);

  // מסע מודרך - סיור רציף דמות-אחר-דמות עם שורת הקשר מקשרת
  const [tour, setTour] = useState(null); // { data, step }
  const [toursOpen, setToursOpen] = useState(false);
  const tourActiveRef = useRef(false);
  const tourJump = (data, step) => {
    tourActiveRef.current = true;
    setTour({ data, step });
    jumpToId(data.stops[step].ref);
  };
  const startTour = (data) => { setToursOpen(false); tourJump(data, 0); };
  const exitTour = () => { tourActiveRef.current = false; setTour(null); };

  // אוספים תמטיים - קבוצות של דמויות/אירועים שקשורים ברעיון אחד
  const [collection, setCollection] = useState(
    () => (INITIAL.coll ? collections.find((c) => c.id === INITIAL.coll) || null : null));
  // מזהה פריט → האוספים שהוא חבר בהם (לצ'יפ בכרטיס)
  const collectionsById = useMemo(() => {
    const m = {};
    for (const c of collections) for (const id of c.members) (m[id] ||= []).push(c);
    return m;
  }, []);
  const openCollection = (c) => { setToursOpen(false); setCollection(c); };
  const [treeOpen, setTreeOpen] = useState(INITIAL.tree);

  /* מדידה. הווים יושבים על המצב ולא על אתר הלחיצה, כי דמות נבחרת
     בחמש דרכים שונות - לחיצה על הציר, חיפוש, קישור נכנס, מסע מודרך
     ושחזור הביקור האחרון. וו אחד על המצב תופס את כולן. */
  useEffect(() => { if (selected) markOnce('item_open', { kind: selected.kind, id: selected.id }); }, [selected]);
  useEffect(() => { if (mapItem) markOnce('map_open', { id: mapItem.id }); }, [mapItem]);
  useEffect(() => { if (treeOpen) markOnce('tree_open'); }, [treeOpen]);
  useEffect(() => { if (toursOpen) markOnce('tours_open'); }, [toursOpen]);
  const [shareMsg, setShareMsg] = useState('');

  // שיתוף התצוגה הנוכחית: שיתוף מקורי במובייל (וואטסאפ וכו'), אחרת העתקה ללוח
  // כפתור הכותרת משתף את האתר עצמו; שיתוף דמות נעשה מתוך הכרטיס שלה.
  // שיתוף "מה שאני רואה": הקישור נושא את המבט (ציר הזמן) ואת הדמות הנבחרת,
  // כך שהמקבל נוחת על אותה תמונה. שיתוף כרטיס בודד נשאר על דף הנחיתה,
  // שיש לו תמונת שיתוף ייחודית ותוכן שנקרא בלי JavaScript.
  const shareView = async () => {
    const contemp = !!(selected && contempItem && itemKey(contempItem) === itemKey(selected));
    const path = buildUrl({ sel: selected ? itemKey(selected) : null, contemp });
    const res = await shareLink({
      url: window.location.origin + path,
      title: selected ? `${selected.name} - ציר הזמן של עם ישראל` : 'ציר הזמן של עם ישראל',
    });
    if (res === 'copied') setShareMsg('הקישור הועתק ✓');
    else if (res === 'failed') setShareMsg('העתיקו מהכתובת שלמעלה');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2200);
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

  // הציר אופקי תמיד. מצב אנכי בוטל - הוא הכפיל את הפריסה בלי להוסיף מידע,
  // ושתי הדרכים להסתכל על הנתונים הן היום ציר הזמן מול מסע הדורות.
  const vertical = false;

  // כניסה/יציאה ממצב ניהול דרך ?admin=1
  useEffect(() => { handleAdminParam(); setIsAdmin(!!getAdminToken()); }, []);

  // מונה תגובות לכל פריט - כדי לסמן על הציר היכן כבר יש דיון
  const [commentCounts, setCommentCounts] = useState({});
  useEffect(() => {
    let alive = true;
    fetchCommentCounts().then((c) => { if (alive) setCommentCounts(c); });
    return () => { alive = false; };
  }, []);

  // מדריך היכרות - בביקור ראשון נפתח מסך-פתיחה קצר ("ברוכים הבאים");
  // כפתור ה-? פותח את הסיור המלא. ההעדפה נשמרת ב-localStorage.
  const [introOpen, setIntroOpen] = useState(() => {
    // נחיתה עם כוונה מפורשת - קישור מדף-נחיתה, מגוגל או משיתוף - אינה
    // נפתחת ב"ברוכים הבאים": המבקר ביקש דמות מסוימת ולא הזמנה כללית.
    // ההעדפה לא נשמרת, כך שכניסה רגילה לדף הבית עדיין תציג את המסך.
    if (INITIAL.sel || INITIAL.map || INITIAL.era || INITIAL.coll || INITIAL.tree) return false;
    try { return !localStorage.getItem('si_seen_intro'); } catch { return false; }
  });
  const [introMode, setIntroMode] = useState(introOpen ? 'welcome' : 'tour');
  const closeIntro = () => {
    setIntroOpen(false);
    try { localStorage.setItem('si_seen_intro', '1'); } catch { /* מתעלמים */ }
  };
  const openTour = () => { setIntroMode('tour'); setIntroOpen(true); };
  // מבט המסע (/atlas) מקבל את הדמות הנבחרת, כדי שהמעבר בין המבטים ימשיך
  // מאותה נקודה במקום לחזור לראש הציר.
  const atlasHref = `/atlas${selected ? `?sel=${itemKey(selected)}` : ''}`;
  const chooseView = (view) => {
    // באיזה משלושת המבטים בוחרים במסך הפתיחה
    mark('view_chosen', { view });
    try { localStorage.setItem('si_view', view); } catch { /* מתעלמים */ }
  };

  // מצב ריק חכם: כשכלום לא נבחר - הזמנה עדינה לדמות היום (נסגרת לסשן)
  const [dailyHintHidden, setDailyHintHidden] = useState(() => {
    try { return !!sessionStorage.getItem('si_daily_hint_off'); } catch { return false; }
  });
  const hideDailyHint = () => {
    setDailyHintHidden(true);
    try { sessionStorage.setItem('si_daily_hint_off', '1'); } catch { /* מתעלמים */ }
  };

  // הדרכה קונטקסטואלית: אחרי הכרטיס השני - טיפ חד-פעמי על אילן היוחסין

  const axis = AXIS[chronology];
  const data = chronology === 'academic'
    ? academicData
    : { leaders, judges, kings, prophets, books, events, periods, world };

  // טווח ההדגשה למצב "בני-הזמן" - תקופת החיים/כהונה של פריט העוגן
  const highlightRange = contempItem
    ? { start: contempItem.start, end: contempItem.end }
    : null;

  // "המשיכו מאיפה שעצרתם" - הדמות האחרונה שנצפתה, לצ'יפ של מבקר חוזר
  const [lastVisited] = useState(() => {
    try {
      const raw = localStorage.getItem('si_last_sel');
      if (!raw) return null;
      const [key, name] = raw.split('|');
      return key && name ? { key, name } : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (!selected) return;
    try { localStorage.setItem('si_last_sel', `${itemKey(selected)}|${selected.name}`); } catch { /* מתעלמים */ }
  }, [selected]);


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
      const title = `${selected.name}${label ? ': ' + label : ''} - ${SITE_TITLE}`;
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

  // אינדקס חיפוש - כל הפריטים הנבחרים מכל הרצועות (ללא תקופות שאינן נבחרות)
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
    // העשרה לחיפוש לפי מקום: כל דמות מקבלת את שמות התחנות במסע חייה (מ-maps)
    const MAPPED = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'world']);
    for (const it of idx) {
      if (!MAPPED.has(it.kind)) continue;
      const m = maps[it.id];
      if (!m) continue;
      const pts = Array.isArray(m) ? m : (m.points || []);
      const names = [...new Set(pts.map((p) => p.name).filter(Boolean))];
      if (names.length) it.places = names;
    }
    return idx;
  }, [chronology]);

  // בני-הזמן של הפריט הנבחר - לשבבי הניווט בכרטיס. רק דמויות (אנשים),
  // לא ספרים/אירועים/מעצמות, שאינם "בני-זמן" במובן הרגיל.
  const PERSON_KINDS = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'world']);
  const selectedContemporaries = useMemo(() => {
    if (!selected) return [];
    const ov = (a, b) => {
      if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
      if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
      return a.start < b.end && a.end > b.start;
    };
    return searchIndex
      .filter((x) => PERSON_KINDS.has(x.kind)
        && !(x.kind === selected.kind && x.id === selected.id)
        && ov(selected, x))
      .sort((a, b) => a.start - b.start);
  }, [selected, searchIndex]);

  // "אולי יעניין אותך גם" - קשרי תקופה ומקום (עמיד: מחושב פעם אחת)
  const placeIndex = useMemo(() => buildPlaceIndex(maps), []);
  const relatedEra = useMemo(() => {
    if (!selected) return [];
    const exclude = new Set(selectedContemporaries.map((c) => `${c.kind}:${c.id}`));
    // רק דמויות (לא ספרים/אירועים) - כדי שהרשימה לא תהיה עמוסה
    const persons = searchIndex.filter((x) => PERSON_KINDS.has(x.kind));
    return relatedByEra(selected, persons, periods, exclude, 6);
  }, [selected, selectedContemporaries, searchIndex]);
  const relatedPlace = useMemo(() => {
    if (!selected) return [];
    return relatedByPlace(selected.id, placeIndex, (id) => ALL_ITEMS.find((x) => x.id === id));
  }, [selected, placeIndex]);

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
  // אב/דמות שקיימת רק במסורת - נעבור למצב מסורת.
  /* contemp=false לכניסה הראשונה: הדגשת בני-הזמן מעמעמת את כל השאר
     ל-14%, וזה מה שמבקר חדש היה רואה בשנייה הראשונה - בלי שביקש. */
  const jumpToId = (id, { contemp = true } = {}) => {
    const item = searchIndex.find((x) => x.id === id);
    if (!item) { if (chronology === 'academic') setChronology('tradition'); return; }
    // סגירת האילן ישירות (לא דרך "אחורה", שהיה מנקה את הבחירה) - אנחנו מנווטים לתצוגה חדשה
    setTreeOpen(false);
    overlayPushed.current = Math.max(0, overlayPushed.current - 1);
    prevOverlay.current = { map: null, tree: false };
    const layer = LAYER_OF[item.kind];
    if (layer) setVisible((v) => (v[layer] ? v : { ...v, [layer]: true }));
    setSelected(item);
    if (contemp) setContempItem(item); // הדגשת בני-הזמן
    if (vertical) { scrollToItem(item); return; }
    // זום-אין כך שתקופת החיים תתפוס כשליש מהרוחב - רואים את הדמות ואת מי שחי במקביל
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
    const contemp = !!(selected && contempItem && itemKey(contempItem) === itemKey(selected));
    const url = buildUrl({ sel: selected ? itemKey(selected) : null, map, step: mapStep, tree: treeOpen, contemp });
    // פתיחת חלונית (מפה/אילן) דוחפת רשומת היסטוריה כדי ש"אחורה" יסגור אותה; שאר השינויים מחליפים בלבד
    const opened = (map && map !== prevOverlay.current.map) || (treeOpen && !prevOverlay.current.tree);
    if (opened) { window.history.pushState({}, '', url); overlayPushed.current += 1; }
    else window.history.replaceState({}, '', url);
    prevOverlay.current = { map, tree: treeOpen };
  }, [selected, mapItem, mapStep, treeOpen, contempItem]);

  /* Escape סוגר גם את שתי השכבות שמרונדרות כאן ולא ברכיב משלהן (אודות
     ובוחר המסעות/אוספים). בכל שאר החלוניות הרכיב מטפל בזה בעצמו, וחוסר
     האחידות הזה הרגיש כמו תקלה. */
  useEffect(() => {
    if (!aboutOpen && !toursOpen && !collection) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (collection) setCollection(null);
      else if (toursOpen) setToursOpen(false);
      else setAboutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aboutOpen, toursOpen, collection]);

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

  // סגירת חלונית: אם דחפנו רשומה - נחזור אחורה (כדי לא לנפח היסטוריה); אחרת נסגור ישירות
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
    // בציר האנכי הגלילה טבעית - אין צורך לדחוס את כל הטווח לגובה המסך
    if (vertical) return MIN_PX;
    return el ? Math.max(MIN_PX, (el.clientWidth - 40 - gutter) / (axis.end - axis.start)) : MIN_PX;
  };

  // זום פתיחה לכל מצב: אופקי - כל הציר על המסך; אנכי - צפיפות נוחה לגלילה
  const VERTICAL_DEFAULT_PX = 2.5;
  const openingPx = () => (vertical ? VERTICAL_DEFAULT_PX : getMinPx());

  // תצוגת פתיחה; ובשינוי גודל חלון - לא להישאר קטן מהמסך.
  // באופקי ללא קישור-עומק נפתחים על חלון OPENING - קריא ומזמין במקום "קיר"
  // של כל ההיסטוריה; הגלילה לקצה הימני מציבה אותנו בתחילתו.
  useEffect(() => {
    const el = scrollRef.current;
    const first = OPENING[chronology];
    const eraPx = el && !vertical && !selected && first
      ? Math.min(MAX_PX, Math.max(getMinPx(), (el.clientWidth - 40) / (first.end - first.start)))
      : null;
    const px = eraPx ?? openingPx();
    // כשהאומדן ההתחלתי כבר קרוב - לא מרנדרים שוב (שומר על הגלילה לקצה הימני)
    if (eraPx == null || Math.abs(eraPx - pxPerYear) / pxPerYear > 0.02) setPxPerYear(px);
    // אם נטענו מכתובת משותפת עם דמות נבחרת - לגלול אליה במקום לקצה
    if (selected) {
      scrollRightPending.current = false;
      if (vertical) scrollToItem(selected);
      else scrollToYear((selected.start + selected.end) / 2, centerOffset(scrollRef.current), px);
    } else if (eraPx != null) {
      // חלון הפתיחה אינו מתחיל עוד בקצה הציר, ולכן גלילה לקצה הימני הייתה
      // מנחיתה אותנו על 1940 ולא עליו - הזום היה משתנה והמסך היה נשאר על
      // האבות. מדמים כאן בדיוק את מה ש-goTo עושה בלחיצה על פריסט.
      scrollRightPending.current = false;
      scrollToYear(first.end, 20, px);
      /* הציר גבוה מהמסך, ולהקות המלכים יושבות מתחת לקפל: להקת המלכים
         מתחילה ב-632px בעוד הגובה הנראה הוא 436. חלון הפתיחה הזה מספר את
         סיפור המלוכה, ולכן בלי גלילה אנכית הוא מציג 6 פריטים במקום 54 -
         גרוע יותר ממה שהיה. עוגן ללהקה עצמה ולא לפיקסל קבוע, כי גובה
         הלהקות משתנה לפי השכבות שהגולש מדליק. */
      const kingsLane = el.querySelector('.lane-kings');
      if (kingsLane) el.scrollTop = Math.max(0, kingsLane.offsetTop - 90);
    }
    const onResize = () => setPxPerYear((p) => Math.max(p, getMinPx()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // החלפת כיוון הציר - התאמת הזום ומיקום הגלילה למצב החדש
  const prevVertical = useRef(vertical);
  useEffect(() => {
    if (prevVertical.current === vertical) return;
    prevVertical.current = vertical;
    setPxPerYear(vertical ? VERTICAL_DEFAULT_PX : getMinPx());
  }, [vertical]);

  // בהחלפת מצב כרונולוגיה בפועל - איפוס לתצוגה מלאה, פתיחה בצד ימין (העבר), וניקוי הבחירה.
  // משווים לערך הקודם (ולא לדגל mount) כדי שלא ננקה מצב ששוחזר מכתובת - עמיד גם ל-StrictMode.
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
  // בטעינה/החלפת מצב - לפתוח בקצה הימני (הזמן הקדום ביותר)
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

  // בזרם האנכי המיקום אינו פרופורציונלי לשנה - גוללים אל השורה עצמה
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

  // ?era=<id> - הגעה משער הכניסה של דף-תקופה. במקום לנחות בתצוגת
  // ברירת המחדל, הציר נפתח כבר על אותה תקופה. ההשהיה נותנת לציר
  // להימדד פעם אחת לפני הגלילה.
  const eraApplied = useRef(false);
  useEffect(() => {
    if (eraApplied.current || !INITIAL.era) return undefined;
    const p = periods.find((x) => x.id === INITIAL.era);
    if (!p) return undefined;
    eraApplied.current = true;
    const t = setTimeout(() => goTo(p), 120);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // התקופה שבמרכז התצוגה - מדליקה את הצ'יפ המתאים בפס התקופות
  const [activeEra, setActiveEra] = useState(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const presets = PRESETS[chronology].filter((p) => p.name !== 'הכל');
      let year = null;
      if (vertical) {
        // הזרם האנכי אינו פרופורציונלי - קוראים את שנת הכותרת האחרונה שנגללה
        const heads = el.querySelectorAll('.vsec-head');
        for (const h of heads) {
          if (h.getBoundingClientRect().top > 260) break;
          const m = (h.getAttribute('aria-label') || '').match(/(\d+)\s*עד/);
          if (m) year = parseInt(m[1], 10) + 1;
        }
      } else {
        year = axis.end - (el.scrollLeft + el.clientWidth / 2) / pxPerYear;
      }
      const hit = year != null ? presets.find((p) => year >= p.start && year <= p.end) : null;
      setActiveEra(hit ? hit.name : null);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [vertical, pxPerYear, chronology, axis.end]);

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
        // הגברת רגישות הצביטה - תנועת אצבעות קטנה נותנת שינוי זום גדול יותר
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

  /* כל הכלים יושבים בשורה הראשונה - גם במחשב. קודם המסעות
     ובית דוד ישבו ליד תיבת החיפוש ונראו כמו מסנני חיפוש, ולא ככלים
     של המסך כמו השיתוף וההערה למנהל. */
  const metaBtns = (
    <>
      <button className="title-ico" onClick={() => setAboutOpen(true)}
        title="אודות הפרויקט" aria-label="אודות הפרויקט">ℹ️</button>
      <button className="title-ico" onClick={openTour}
        title="מדריך היכרות" aria-label="מדריך היכרות">❓</button>
    </>
  );
  const toolBtns = (
    <>
      <button className="tree-btn" onClick={() => setToursOpen(true)} title="מסעות מודרכים - סיור דמות-אחר-דמות">
        <span aria-hidden="true">🧭</span> <span className="btn-label">מסעות</span>
      </button>
      {/* "תובנות" הוסר לבקשת המשתמש - הסרגל היה עמוס מדי. הרכיב
          Insights.jsx נשאר במקומו, כך שהחזרה היא כפתור אחד. */}
      <button className="tree-btn" onClick={() => setTreeOpen(true)} title="בית דוד - אילן היוחסין">
        <span aria-hidden="true">👑</span> <span className="btn-label">בית דוד</span>
      </button>
      {/* סוכן השאלות - בבדיקה, ולכן מוצג רק במצב ניהול */}
      {isAdmin && (
        <button className="tree-btn ask-btn" onClick={() => setAskOpen(true)} title="שאלו על האתר (בדיקה - מנהל בלבד)">
          <span aria-hidden="true">🔎</span> <span className="btn-label">שאלו</span>
        </button>
      )}
    </>
  );

  return (
    <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <header>
        <div className="header-top">
          <div className="title-block">
            <div className="title-row">
              {/* במסך צר נשאר "ציר הזמן" בלבד: השם המלא דחף את אייקוני
                  הכותרת לשורה שנייה, והסרגל התחתון ממילא חוזר עליו. */}
              <h1>ציר הזמן<span className="h1-rest"> של עם ישראל</span></h1>
              {/* תג הביתא הוא כפתור ולא תווית: "ביתא" בלי דרך להגיב
                  עליו הוא רק תירוץ מראש. לחיצה פותחת את תיבת המשוב. */}
              <button className="beta-chip" onClick={() => setNotesOpen(true)} title="האתר בגרסת ביתא - לחצו לשליחת משוב, תיקון או דיווח על טעות">ביתא</button>
              {/* אודות ומדריך כאייקונים לצד שם המצב, במקום תפריט ⋯ שדרש
                  לחיצה כדי לגלות מה יש בו. במסך צר הם עוברים לקבוצת
                  הכלים שבצד השני של השורה. */}
              <span className="title-icons">{metaBtns}</span>
            </div>
            <span className="subtitle">
              {isAcademic
                ? 'מהמלוכה עד חורבן בית שני · לפי הכרונולוגיה המחקרית'
                : 'מהאבות עד חורבן בית שני · לפי המסורת (סדר עולם)'}
            </span>
          </div>
          {/* מתג מפוצל במרכז הבר: שתי האפשרויות גלויות תמיד והנוכחית מודגשת.
              כפתור בודד ("מסע הדורות") נקרא כמו עוד כלי בסרגל, ולא כמעבר בין
              שני מצבים של אותה אפליקציה. */}
          <div className="mode-switch" role="group" aria-label="מצב תצוגה">
            <span className="ms-opt on" aria-current="page">
              <span aria-hidden="true">📜</span> ציר הזמן
            </span>
            <a className="ms-opt" href={atlasHref} title="דמות אחר דמות, עם המפה והסיפור לצדה">
              <span aria-hidden="true">🗺️</span> מסע הדורות
            </a>
            <a className="ms-opt" href="/places" title="לפי מקום: מי עבר בכל מקום ומה קרה שם">
              <span aria-hidden="true">📍</span> מפת הארץ
            </a>
          </div>
          <div className="header-actions">
          {toolBtns}
          {/* הערה למנהל הייתה קבורה בתפריט ⋯ ברוחב 22px, ובמובייל הוסתרה
              לגמרי. כאן היא כפתור משלה, גלוי בשני הגדלים. */}
          <button className="share-btn note-btn" onClick={() => setNotesOpen(true)} title="הערה, תיקון או מקור למנהל האתר">
            <span aria-hidden="true">✉️</span>
            <span className="btn-label">הערה למנהל</span>
          </button>
          <button className="share-btn" onClick={shareView} title="שיתוף האתר">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
            </svg>
            <span className="btn-label">שיתוף</span>
          </button>
          {shareMsg && <span className="share-msg">{shareMsg}</span>}
          <button
            className="menu-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            <span className="btn-label"> {menuOpen ? 'סגירה' : 'אפשרויות'}</span>
          </button>
          </div>
        </div>
        <div className="search-row">
          <SearchBox index={searchIndex} onPick={jumpTo} />
        </div>
        {/* במסך צר הבקרים מקופלים מאחורי שורה משלהם: המילה "שכבות" וחץ
            שמסתובב. כפתור אייקון בכותרת לא אמר מה הוא פותח, ולא היה בו
            סימן אם התפריט פתוח או סגור. */}
        <button
          className={`layers-toggle${menuOpen ? ' open' : ''}`}
          aria-expanded={menuOpen} aria-controls="ctrl-drawer"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span>שכבות ומקרא</span>
          <svg className="lt-caret" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path d="M4 9 L12 17 L20 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div id="ctrl-drawer" className={`controls${menuOpen ? ' open' : ''}`}>
          <div className="ctrl-stack">
            <div className="ctrl-group">
              <span className="ctrl-label">שכבות</span>
              <div className="toggles">
                {/* אותו סדר כמו רצועות ציר הזמן עצמו, מלמעלה למטה */}
                <label><input type="checkbox" checked={visible.events} onChange={() => toggle('events')} /> <span className="tg-dot dot-events" aria-hidden="true" />אירועים</label>
                {!isAcademic && <label><input type="checkbox" checked={visible.leaders} onChange={() => toggle('leaders')} /> <span className="tg-dot dot-leaders" aria-hidden="true" />אבות ומנהיגים</label>}
                {!isAcademic && <label><input type="checkbox" checked={visible.judges} onChange={() => toggle('judges')} /> <span className="tg-dot dot-judges" aria-hidden="true" />שופטים</label>}
                <label><input type="checkbox" checked={visible.kings} onChange={() => toggle('kings')} /> <span className="tg-dot dot-kings" aria-hidden="true" />מלכים</label>
                <label><input type="checkbox" checked={visible.prophets} onChange={() => toggle('prophets')} /> <span className="tg-dot dot-prophets" aria-hidden="true" />נביאים</label>
                <label><input type="checkbox" checked={visible.books} onChange={() => toggle('books')} /> <span className="tg-dot dot-books" aria-hidden="true" />ספרים</label>
                <label><input type="checkbox" checked={visible.world} onChange={() => toggle('world')} /> <span className="tg-dot dot-world" aria-hidden="true" />רקע עולמי</label>
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

      {/* פס תקופות קבוע - אוריינטציה ("איפה אני?") וניווט ("קח אותי") במחווה אחת */}
      <nav className="era-strip" aria-label="ניווט תקופות">
        {PRESETS[chronology].map((p) => (
          <button
            key={p.name}
            className={`era-chip${p.name === 'הכל' ? ' era-all' : ''}${activeEra === p.name ? ' on' : ''}`}
            onClick={() => goTo(p)}
            aria-current={activeEra === p.name ? 'true' : undefined}
          >{p.name}</button>
        ))}
      </nav>

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
        <span className="legend-judgments">
          <span className="lg dot-lg"><span className="dot good" /> הישר בעיני ה'</span>
          <span className="lg dot-lg"><span className="dot bad" /> הרע בעיני ה'</span>
          <span className="lg dot-lg"><span className="dot mixed" /> מעורב</span>
        </span>
      </div>

      {isAcademic && (
        <div className="academic-note">
          במצב זה מוצגות רק תקופות שלהן תיארוך מחקרי מבוסס (מהמלוכה ואילך, מלכים לפי כרונולוגיית Thiele).
          תקופת האבות, יציאת מצרים והשופטים אינה מתוארכת בהסכמה מחקרית - ולכן אינה מוצגת כאן. ייתכנו הפרשים של שנים ספורות בין חוקרים.
        </div>
      )}

      {vertical ? (
        <div className="vtl-wrap" ref={scrollRef} role="main" aria-label="ציר הזמן">
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
        <div className="scroll-area" ref={scrollRef} dir="ltr" role="main" aria-label="ציר הזמן" tabIndex={0}>
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

      {/* כשכל השכבות כבויות הציר ריק, ולא ברור אם הכל בסדר */}
      {!Object.values(visible).some(Boolean) && (
        <p className="tl-empty">
          כל השכבות כבויות, ולכן הציר ריק.{' '}
          <button className="tree-btn" onClick={() => setVisible(DEFAULT_VISIBLE)}>הדלקת כל השכבות</button>
        </p>
      )}

      {!selected && !vertical && (
        <div className="fab-zoom">
          <button onClick={() => zoom(1.4)} aria-label="התקרבות">+</button>
          <button onClick={() => zoom(0.7)} aria-label="התרחקות">−</button>
        </div>
      )}

      {/* מצב ריק: הזמנה לדמות היום - נקודת כניסה במקום מסך אילם */}
      {/* שורת המסע המודרך - כותרת, הקשר, וניווט תחנות */}
      {tour && (
        <div className="tour-bar" role="region" aria-label="מסע מודרך">
          <button className="tour-x" onClick={exitTour} aria-label="יציאה מהמסע">✕</button>
          <div className="tour-info">
            <div className="tour-title">
              {tour.data.icon} {tour.data.title} · <span dir="ltr">{tour.step + 1}/{tour.data.stops.length}</span>
            </div>
            <div className="tour-note">{tour.data.stops[tour.step].note}</div>
          </div>
          <div className="tour-nav">
            <button className="tour-btn" disabled={tour.step === 0} onClick={() => tourJump(tour.data, tour.step - 1)}>הקודם</button>
            {tour.step < tour.data.stops.length - 1
              ? <button className="tour-btn tour-next" onClick={() => tourJump(tour.data, tour.step + 1)}>הבא</button>
              : <button className="tour-btn tour-next" onClick={exitTour}>סיום ✓</button>}
          </div>
        </div>
      )}

      {/* בוחר מסעות ואוספים */}
      {toursOpen && (
        <div className="tours-overlay" onClick={() => setToursOpen(false)}>
          <div className="tours-panel" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setToursOpen(false)} aria-label="סגירה">✕</button>
            <h3 className="tours-title">🧭 מסעות מודרכים</h3>
            <p className="tours-sub">סיור דמות-אחר-דמות עם ההקשר המחבר - מתקדמים בקצב שלכם</p>
            {/* מסע שיש לו אוסף מקביל מוצג רק שם, כדי לא לחזור על אותו שם פעמיים */}
            {tours.filter((t) => !collections.some((c) => c.tour === t.id)).map((t) => (
              <button key={t.id} className="tour-card" onClick={() => startTour(t)}>
                <span className="tour-card-icon" aria-hidden="true">{t.icon}</span>
                <span className="tour-card-body">
                  <b>{t.title}</b>
                  <small>{t.subtitle} · {t.stops.length} תחנות</small>
                </span>
              </button>
            ))}
            <h3 className="tours-title tours-title-2">👭 אוספים</h3>
            <p className="tours-sub">קבוצות שקשורות ברעיון אחד - הצצה לכולן במבט</p>
            {collections.map((c) => (
              <button key={c.id} className="tour-card" onClick={() => openCollection(c)}>
                <span className="tour-card-icon" aria-hidden="true">{c.icon}</span>
                <span className="tour-card-body">
                  <b>{c.title}</b>
                  <small>{c.subtitle} · {c.members.length} דמויות</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* תצוגת אוסף - התיאור וכל החברים כרשימה לחיצה */}
      {collection && (
        <div className="tours-overlay" onClick={() => setCollection(null)}>
          <div className="tours-panel" onClick={(e) => e.stopPropagation()}>
            <button className="about-close" onClick={() => setCollection(null)} aria-label="סגירה">✕</button>
            <h3 className="tours-title">{collection.icon} {collection.title}</h3>
            <p className="tours-sub">{collection.subtitle}</p>
            <p className="coll-desc">{collection.description}</p>
            {collection.tour && tours.some((t) => t.id === collection.tour) && (
              <button
                className="coll-tour-btn"
                onClick={() => { const t = tours.find((x) => x.id === collection.tour); setCollection(null); startTour(t); }}
              >🧭 התחילו סיור מודרך באוסף</button>
            )}
            <div className="coll-list">
              {collection.members.map((id) => {
                const it = searchIndex.find((x) => x.id === id);
                if (!it) return null;
                return (
                  <button key={id} className="coll-item" onClick={() => { setCollection(null); jumpToId(id); }}>
                    <span className={`sr-dot ${it.kind}`} />
                    <span className="coll-item-name">{it.name}</span>
                    <span className="coll-item-years">{it.start === it.end ? it.start : `${it.start}–${it.end}`}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* "דמות היום" הוסרה כדי לא לפזר את תשומת הלב בכניסה; ההצעה לחזור
          למקום שבו הפסקתם נשארה, כי היא ממשיכה משהו שהמבקר כבר התחיל. */}
      {!selected && !introOpen && !contempItem && !tour && lastVisited && !dailyHintHidden && (
        <div className="daily-hint">
          <button
            className="daily-hint-go daily-hint-resume"
            onClick={() => {
              const it = searchIndex.find((x) => itemKey(x) === lastVisited.key);
              if (it) jumpTo(it);
            }}
          >
            ⏮ המשיכו: <b>{lastVisited.name}</b>
          </button>
          <button className="daily-hint-x" onClick={hideDailyHint} aria-label="סגירת ההצעה">✕</button>
        </div>
      )}

      {/* טיפ חד-פעמי אחרי הכרטיס השני - גילוי האילן */}
      {contempItem && !selected && (
        <button className="contemp-clear" onClick={() => setContempItem(null)}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
          בני-הזמן של {contempItem.name}
          <span className="cc-x" aria-hidden="true">✕</span>
        </button>
      )}

      {/* מובייל: רקע מוכהה מאחורי הגיליון - הקשה עליו סוגרת */}
      {isMobile && selected && <div className="sheet-backdrop" onClick={() => setSelected(null)} />}
      {selected && (
        <div className={`card-dock${!isMobile && maps[selected.id] && !mapMin ? ' with-map' : ''}${isMobile ? ` sheet ${sheetPos}` : ''}`}>
          {isMobile && (
            <button
              className="sheet-handle"
              aria-label={sheetPos === 'half' ? 'הרחבת הכרטיס' : 'כיווץ הכרטיס'}
              onClick={() => setSheetPos((p) => (p === 'half' ? 'full' : 'half'))}
              onTouchStart={(e) => { sheetTouchY.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => {
                const y0 = sheetTouchY.current; sheetTouchY.current = null;
                if (y0 == null) return;
                const dy = e.changedTouches[0].clientY - y0;
                if (dy < -40) setSheetPos('full');
                else if (dy > 40) { if (sheetPos === 'full') setSheetPos('half'); else setSelected(null); }
              }}
            >
              <span className="sheet-grip" aria-hidden="true" />
            </button>
          )}
          <DetailCard
            item={selected} mode={chronology}
            onClose={() => setSelected(null)}
            onOpenMap={isMobile && maps[selected.id] ? () => setMapOpen(true) : undefined}
            contemporariesOn={!!(selected && contempItem && itemKey(selected) === itemKey(contempItem))}
            onToggleContemporaries={() =>
              setContempItem((prev) =>
                prev && selected && itemKey(prev) === itemKey(selected) ? null : selected
              )
            }
            prevItem={prevItem} nextItem={nextItem} onNav={jumpTo}
            axisStart={axis.start} axisEnd={axis.end}
            contemporaries={selectedContemporaries}
            switchHref={`/atlas?sel=${itemKey(selected)}`} switchLabel="מסע הדורות"
            collections={collectionsById[selected.id] || []}
            onOpenCollection={openCollection}
            commentCount={selected ? (commentCounts[itemKey(selected)] || 0) : 0}
            openComments={INITIAL.comments}
          />
          {!isMobile && maps[selected.id] && (
            <JourneyMap
              docked item={selected}
              minimized={mapMin}
              onToggleMin={() => setMapMin((m) => !m)}
            />
          )}
        </div>
      )}

      {/* מובייל: מפת המסע נפתחת כשכבה מלאה לפי דרישה, לא מחולקת עם הכרטיס */}
      {isMobile && mapOpen && selected && maps[selected.id] && (
        <JourneyMap item={selected} onClose={() => setMapOpen(false)} />
      )}

      <FamilyTree open={treeOpen} onClose={() => closeOverlay(() => setTreeOpen(false))} onJump={jumpToId} />

      {/* מובייל: הסרגל התחתון הוא מתג המצבים ולא מגירת כלים. המעבר בין שני
          המבטים היה הפעולה הכי פחות מובנת למבקר חדש, והוא זה שראוי למקום
          הקבוע והנוח ביותר; הכלים עלו לשורה העליונה. */}
      {isMobile && (
        <nav className="bottom-nav mode-nav" aria-label="מצבי תצוגה">
          <span className="mn-tab on" aria-current="page">
            <span aria-hidden="true">📜</span>ציר הזמן
          </span>
          <a className="mn-tab" href={atlasHref}>
            <span aria-hidden="true">🗺️</span>מסע הדורות
          </a>
          <a className="mn-tab" href="/places">
            <span aria-hidden="true">📍</span>מפת הארץ
          </a>
        </nav>
      )}

      <footer>
        הזמן זורם מימין (עבר) לשמאל · Ctrl+גלגלת לזום
        {' · '}
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
              ובפרטים - ואשמח לכל תיקון והערה. שימוש נעים! 📖
            </p>
            <a className="feedback-btn" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
              💬 משוב · דיווח על תקלה · הצעת תיקון
            </a>
            {/* חובה נגישה ולא הערת שוליים: האתר אוסף סטטיסטיקה ושומר
                פניות עם פרטי קשר, ומי שרוצה לדעת מה נאסף צריך למצוא זאת. */}
            <p className="about-legal"><a href="/privacy">מדיניות פרטיות</a> · <a href="/terms">תנאי שימוש</a> · <a href="/accessibility">נגישות</a></p>
          </div>
        </div>
      )}

      <Intro
        open={introOpen} onClose={closeIntro} visible={visible} setVisible={setVisible}
        mode={introMode} onStartJourney={() => jumpToId('avraham', { contemp: false })} onCloseCard={() => setSelected(null)}
        atlasHref={atlasHref} onChooseView={chooseView}
      />
      <NotesBox open={notesOpen} onClose={() => setNotesOpen(false)} />
      <AskBox
        open={askOpen}
        onClose={() => setAskOpen(false)}
        onJump={(key) => {
          const i = key.indexOf(':');
          const kind = key.slice(0, i), id = key.slice(i + 1);
          // מקומות ותקופות חיים מחוץ לציר הזמן - אליהם מנווטים, לשאר קופצים במקום
          if (kind === 'place') { window.location.href = `/places?p=${encodeURIComponent(id)}`; return; }
          if (kind === 'period') { window.location.href = `/p/period/${id}`; return; }
          setAskOpen(false);
          jumpToId(id);
        }}
      />
    </div>
  );
}
