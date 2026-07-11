import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Timeline, { LABEL_GUTTER_PX } from './components/Timeline.jsx';
import DetailCard from './components/DetailCard.jsx';
import MapPanel from './components/MapPanel.jsx';
import SearchBox from './components/SearchBox.jsx';
import FamilyTree from './components/FamilyTree.jsx';
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
  const [showContemporaries, setShowContemporaries] = useState(false);
  const [treeOpen, setTreeOpen] = useState(INITIAL.tree);
  const [shareMsg, setShareMsg] = useState('');

  // שיתוף התצוגה הנוכחית: שיתוף מקורי במובייל (וואטסאפ וכו'), אחרת העתקה ללוח
  const shareView = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'ציר הזמן של עם ישראל', url }); } catch { /* בוטל */ }
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
  const [visible, setVisible] = useState({ leaders: true, judges: true, kings: true, prophets: true, books: true, events: true, world: true });

  const axis = AXIS[chronology];
  const data = chronology === 'academic'
    ? academicData
    : { leaders, judges, kings, prophets, books, events, periods, world };

  // טווח ההדגשה למצב "בני-הזמן" — תקופת החיים/כהונה של הפריט הנבחר
  const highlightRange = selected && showContemporaries
    ? { start: selected.start, end: selected.end }
    : null;

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
    const el = scrollRef.current;
    const midYear = (item.start + item.end) / 2;
    scrollToYear(midYear, el ? el.clientWidth / 2 : 0, pxPerYear);
  };

  // קפיצה לפי מזהה (מאילן היוחסין). אב/דמות שקיימת רק במסורת — נעבור למצב מסורת.
  const jumpToId = (id) => {
    const item = searchIndex.find((x) => x.id === id);
    if (item) jumpTo(item);
    else if (chronology === 'academic') setChronology('tradition');
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
      const el = scrollRef.current;
      scrollToYear((selItem.start + selItem.end) / 2, el ? el.clientWidth / 2 : 0, px ?? pxPerYear);
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
    return el ? Math.max(MIN_PX, (el.clientWidth - 40 - gutter) / (axis.end - axis.start)) : MIN_PX;
  };

  // תצוגת פתיחה: כל הציר על המסך; ובשינוי גודל חלון — לא להישאר קטן מהמסך
  useEffect(() => {
    const minPx = getMinPx();
    setPxPerYear(minPx);
    // אם נטענו מכתובת משותפת עם דמות נבחרת — לגלול אליה במקום לקצה הימני
    if (selected) {
      scrollRightPending.current = false;
      const el = scrollRef.current;
      scrollToYear((selected.start + selected.end) / 2, el ? el.clientWidth / 2 : 0, minPx);
    }
    const onResize = () => setPxPerYear((p) => Math.max(p, getMinPx()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // בהחלפת מצב כרונולוגיה בפועל — איפוס לתצוגה מלאה, פתיחה בצד ימין (העבר), וניקוי הבחירה.
  // משווים לערך הקודם (ולא לדגל mount) כדי שלא ננקה מצב ששוחזר מכתובת — עמיד גם ל-StrictMode.
  const prevChrono = useRef(chronology);
  useEffect(() => {
    if (prevChrono.current === chronology) return;
    prevChrono.current = chronology;
    setSelected(null); setMapItem(null); setTreeOpen(false);
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
      el.scrollLeft = el.scrollWidth; // הקצה הימני = תחילת הציר (העבר)
      return;
    }
    if (!pendingScroll.current) return;
    const { year, offset } = pendingScroll.current;
    pendingScroll.current = null;
    el.scrollLeft = (axis.end - year) * pxPerYear - offset;
  }, [pxPerYear, chronology]);

  const scrollToYear = (year, offset, px) => {
    const el = scrollRef.current;
    if (px === pxPerYear) el.scrollLeft = (axis.end - year) * px - offset;
    else {
      pendingScroll.current = { year, offset };
      setPxPerYear(px);
    }
  };

  const goTo = (preset) => {
    const el = scrollRef.current;
    if (!el) return;
    const px = Math.min(MAX_PX, Math.max(getMinPx(), (el.clientWidth - 40) / (preset.end - preset.start)));
    scrollToYear(preset.end, 20, px);
  };

  const zoom = (factor, anchorX) => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = anchorX ?? el.clientWidth / 2;
    const yearAtAnchor = axis.end - (el.scrollLeft + offset) / pxPerYear;
    const px = Math.min(MAX_PX, Math.max(getMinPx(), pxPerYear * factor));
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
          <button className="share-btn" onClick={shareView} title="שיתוף התצוגה הנוכחית">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
            </svg>
            שיתוף
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
          <div className="zoom-btns">
            <button onClick={() => zoom(1.4)} title="התקרבות">+</button>
            <button onClick={() => zoom(0.7)} title="התרחקות">−</button>
          </div>
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

      <div className="scroll-area" ref={scrollRef} dir="ltr">
        <Timeline
          pxPerYear={pxPerYear} gutter={gutter}
          startYear={axis.start} endYear={axis.end} mode={chronology}
          periods={data.periods} leaders={data.leaders} judges={data.judges} kings={data.kings}
          prophets={data.prophets} books={data.books} events={data.events} world={data.world}
          visible={visible} selected={selected} onSelect={setSelected}
          highlightRange={highlightRange}
        />
      </div>

      {!selected && (
        <div className="fab-zoom">
          <button onClick={() => zoom(1.4)} aria-label="התקרבות">+</button>
          <button onClick={() => zoom(0.7)} aria-label="התרחקות">−</button>
        </div>
      )}

      <DetailCard
        item={selected} mode={chronology}
        onClose={() => setSelected(null)}
        onOpenMap={(it) => { setMapStep(-1); setMapItem(it); }}
        contemporariesOn={showContemporaries}
        onToggleContemporaries={() => setShowContemporaries((o) => !o)}
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
          </div>
        </div>
      )}
    </div>
  );
}
