import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Timeline from './components/Timeline.jsx';
import DetailCard from './components/DetailCard.jsx';
import MapPanel from './components/MapPanel.jsx';
import leaders from './data/leaders.json';
import judges from './data/judges.json';
import kings from './data/kings.json';
import prophets from './data/prophets.json';
import books from './data/books.json';
import events from './data/events.json';
import periods from './data/periods.json';
import { academicData } from './utils/academic.js';

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

export default function App() {
  const scrollRef = useRef(null);
  const [pxPerYear, setPxPerYear] = useState(1);
  const [selected, setSelected] = useState(null);
  const [chronology, setChronology] = useState('tradition');
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mapItem, setMapItem] = useState(null);
  const [visible, setVisible] = useState({ leaders: true, judges: true, kings: true, prophets: true, books: true, events: true });

  const axis = AXIS[chronology];
  const data = chronology === 'academic'
    ? academicData
    : { leaders, judges, kings, prophets, books, events, periods };

  // הזום המינימלי: כל הציר בדיוק ברוחב החלון
  const getMinPx = () => {
    const el = scrollRef.current;
    return el ? Math.max(MIN_PX, (el.clientWidth - 40) / (axis.end - axis.start)) : MIN_PX;
  };

  // תצוגת פתיחה: כל הציר על המסך; ובשינוי גודל חלון — לא להישאר קטן מהמסך
  useEffect(() => {
    setPxPerYear(getMinPx());
    const onResize = () => setPxPerYear((p) => Math.max(p, getMinPx()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // בהחלפת מצב כרונולוגיה — איפוס לתצוגה מלאה וניקוי הבחירה
  useEffect(() => {
    setSelected(null);
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
    setPxPerYear(getMinPx());
  }, [chronology]);

  // גלילה ממתינה: מוחלת רק אחרי שהקנבס צויר מחדש ברוחב החדש (useLayoutEffect)
  const pendingScroll = useRef(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !pendingScroll.current) return;
    const { year, offset } = pendingScroll.current;
    pendingScroll.current = null;
    el.scrollLeft = (axis.end - year) * pxPerYear - offset;
  }, [pxPerYear]);

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
          <div className="chrono-toggle" role="group" aria-label="בחירת כרונולוגיה">
            <button
              className={!isAcademic ? 'active' : ''}
              onClick={() => setChronology('tradition')}
            >סדר עולם</button>
            <button
              className={isAcademic ? 'active' : ''}
              onClick={() => setChronology('academic')}
            >היסטוריה מחקרית</button>
          </div>
          <button
            className="menu-btn"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >{menuOpen ? '✕ סגירה' : '☰ אפשרויות'}</button>
        </div>
        <div className={`controls${menuOpen ? ' open' : ''}`}>
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
          pxPerYear={pxPerYear}
          startYear={axis.start} endYear={axis.end} mode={chronology}
          periods={data.periods} leaders={data.leaders} judges={data.judges} kings={data.kings}
          prophets={data.prophets} books={data.books} events={data.events}
          visible={visible} selected={selected} onSelect={setSelected}
        />
      </div>

      {!selected && (
        <div className="fab-zoom">
          <button onClick={() => zoom(1.4)} aria-label="התקרבות">+</button>
          <button onClick={() => zoom(0.7)} aria-label="התרחקות">−</button>
        </div>
      )}

      <DetailCard item={selected} mode={chronology} onClose={() => setSelected(null)} onOpenMap={setMapItem} />

      <MapPanel item={mapItem} onClose={() => setMapItem(null)} />

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
