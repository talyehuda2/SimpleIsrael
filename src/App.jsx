import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Timeline, { START_YEAR, END_YEAR, yearToX } from './components/Timeline.jsx';
import DetailCard from './components/DetailCard.jsx';
import leaders from './data/leaders.json';
import kings from './data/kings.json';
import prophets from './data/prophets.json';
import books from './data/books.json';
import events from './data/events.json';
import periods from './data/periods.json';

const PRESETS = [
  { name: 'הכל', start: START_YEAR, end: END_YEAR },
  { name: 'האבות', start: 1940, end: 2250 },
  { name: 'מצרים והמדבר', start: 2230, end: 2495 },
  { name: 'התנחלות ושופטים', start: 2488, end: 2890 },
  { name: 'הממלכה המאוחדת', start: 2860, end: 2975 },
  { name: 'יהודה וישראל', start: 2955, end: 3215 },
  { name: 'סוף בית ראשון', start: 3190, end: 3345 },
  { name: 'גלות ושיבת ציון', start: 3320, end: 3460 },
  { name: 'בית שני', start: 3380, end: 3840 },
];

const MIN_PX = 0.4;
const MAX_PX = 20;

export default function App() {
  const scrollRef = useRef(null);
  const [pxPerYear, setPxPerYear] = useState(1);
  const [selected, setSelected] = useState(null);
  const [visible, setVisible] = useState({ leaders: true, kings: true, prophets: true, books: true, events: true });

  // הזום המינימלי: כל הציר בדיוק ברוחב החלון
  const getMinPx = () => {
    const el = scrollRef.current;
    return el ? Math.max(MIN_PX, (el.clientWidth - 40) / (END_YEAR - START_YEAR)) : MIN_PX;
  };

  // תצוגת פתיחה: כל הציר על המסך; ובשינוי גודל חלון — לא להישאר קטן מהמסך
  useEffect(() => {
    setPxPerYear(getMinPx());
    const onResize = () => setPxPerYear((p) => Math.max(p, getMinPx()));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // גלילה ממתינה: מוחלת רק אחרי שהקנבס צויר מחדש ברוחב החדש (useLayoutEffect),
  // אחרת הדפדפן חותך את הגלילה לפי הרוחב הישן
  const pendingScroll = useRef(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !pendingScroll.current) return;
    const { year, offset } = pendingScroll.current;
    pendingScroll.current = null;
    el.scrollLeft = (END_YEAR - year) * pxPerYear - offset;
  }, [pxPerYear]);

  const scrollToYear = (year, offset, px) => {
    const el = scrollRef.current;
    if (px === pxPerYear) el.scrollLeft = (END_YEAR - year) * px - offset;
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
    const yearAtAnchor = END_YEAR - (el.scrollLeft + offset) / pxPerYear;
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
      zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - rect.left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const toggle = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="app">
      <header>
        <div className="title-block">
          <h1>ציר הזמן של עם ישראל</h1>
          <span className="subtitle">מהכניסה לארץ עד חורבן בית שני · לפי המסורת (סדר עולם)</span>
        </div>
        <div className="controls">
          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => goTo(p)}>{p.name}</button>
            ))}
          </div>
          <div className="toggles">
            <label><input type="checkbox" checked={visible.leaders} onChange={() => toggle('leaders')} /> אבות ומנהיגים</label>
            <label><input type="checkbox" checked={visible.kings} onChange={() => toggle('kings')} /> מלכים</label>
            <label><input type="checkbox" checked={visible.prophets} onChange={() => toggle('prophets')} /> נביאים</label>
            <label><input type="checkbox" checked={visible.books} onChange={() => toggle('books')} /> ספרים</label>
            <label><input type="checkbox" checked={visible.events} onChange={() => toggle('events')} /> אירועים</label>
          </div>
          <div className="zoom-btns">
            <button onClick={() => zoom(1.4)} title="התקרבות">+</button>
            <button onClick={() => zoom(0.7)} title="התרחקות">−</button>
          </div>
        </div>
      </header>

      <div className="legend">
        <span className="lg leader">אבות ומנהיגים</span>
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

      <div className="scroll-area" ref={scrollRef} dir="ltr">
        <Timeline
          pxPerYear={pxPerYear}
          periods={periods} leaders={leaders} kings={kings} prophets={prophets} books={books} events={events}
          visible={visible} selected={selected} onSelect={setSelected}
        />
      </div>

      <DetailCard item={selected} onClose={() => setSelected(null)} />

      <footer>
        הזמן זורם מימין (עבר) לשמאל · Ctrl+גלגלת לזום · התאריכים משוערים לפי המסורת; ייתכנו חפיפות בין מלכים (מלוכה משותפת)
      </footer>
    </div>
  );
}
