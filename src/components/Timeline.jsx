import { useMemo } from 'react';
import { hebrewYearLetters, toSecular } from '../utils/dates.js';

// ציר הזמן זורם מימין (עבר) לשמאל (הווה), כקריאה בעברית.
// x = מרחק מהקצה השמאלי = (END_YEAR - שנה) * פיקסלים-לשנה.

export const START_YEAR = 1940;
export const END_YEAR = 3850;

export function yearToX(year, pxPerYear) {
  return (END_YEAR - year) * pxPerYear;
}

// שיבוץ פריטים חופפים בשורות נפרדות (greedy interval packing)
function packRows(items) {
  const sorted = [...items].sort((a, b) => b.start - a.start || b.end - a.end);
  const rowEnds = []; // לכל שורה: השנה המוקדמת ביותר שכבר תפוסה (הפריטים נעים מימין לשמאל)
  const placed = [];
  for (const item of sorted) {
    let row = rowEnds.findIndex((minStart) => item.end <= minStart);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(Infinity);
    }
    rowEnds[row] = item.start;
    placed.push({ ...item, row });
  }
  return { items: placed, rows: rowEnds.length };
}

function tickStep(pxPerYear) {
  if (pxPerYear >= 8) return 10;
  if (pxPerYear >= 3) return 25;
  if (pxPerYear >= 1.2) return 50;
  return 100;
}

function Bar({ item, pxPerYear, kind, selected, onSelect, rowHeight = 30, row = 0 }) {
  const left = yearToX(item.end, pxPerYear);
  const width = Math.max((item.end - item.start) * pxPerYear, 6);
  const showLabel = width > 34;
  const showDot = width > 24;
  return (
    <div
      className={`bar ${kind} ${selected ? 'selected' : ''}`}
      style={{ left, width, top: row * rowHeight + 22 }}
      title={`${item.name} · ${item.start}–${item.end}`}
      onClick={() => onSelect({ ...item, kind })}
    >
      {item.judgment && showDot && <span className={`dot ${item.judgment}`} />}
      {showLabel && <span className="bar-label">{item.name}</span>}
    </div>
  );
}

export default function Timeline({
  pxPerYear, periods, leaders, kings, prophets, books, events,
  visible, selected, onSelect,
}) {
  const totalWidth = (END_YEAR - START_YEAR) * pxPerYear;

  const ticks = useMemo(() => {
    const step = tickStep(pxPerYear);
    const list = [];
    for (let y = Math.ceil(START_YEAR / step) * step; y <= END_YEAR; y += step) list.push(y);
    return list;
  }, [pxPerYear]);

  const packedLeaders = useMemo(() => packRows(leaders), [leaders]);
  const packedProphets = useMemo(() => packRows(prophets), [prophets]);
  const packedBooks = useMemo(() => packRows(books), [books]);
  const packedEvents = useMemo(() => {
    // אירועים נקודתיים — שיבוץ לפי מרחק תוויות כדי שלא יתנגשו
    const sorted = [...events].sort((a, b) => b.year - a.year);
    const labelYears = 150 / pxPerYear; // רוחב משוער של תווית בשנים
    const rowLast = [];
    const items = sorted.map((ev) => {
      let row = rowLast.findIndex((last) => last - ev.year >= labelYears);
      if (row === -1) { row = rowLast.length; rowLast.push(Infinity); }
      rowLast[row] = ev.year;
      return { ...ev, row };
    });
    return { items, rows: rowLast.length };
  }, [events, pxPerYear]);

  const isSel = (kind, id) => selected && selected.kind === kind && selected.id === id;

  return (
    <div className="timeline-canvas" style={{ width: totalWidth }}>
      {/* קווי רשת + ציר שנים */}
      <div className="axis">
        {ticks.map((y) => (
          <div key={y} className="tick" style={{ left: yearToX(y, pxPerYear) }}>
            <div className="tick-heb">{hebrewYearLetters(y)}</div>
            <div className="tick-num">{y}</div>
            <div className="tick-sec">{toSecular(y)}</div>
          </div>
        ))}
      </div>
      {ticks.map((y) => (
        <div key={y} className="gridline" style={{ left: yearToX(y, pxPerYear) }} />
      ))}

      {/* תקופות */}
      <div className="lane lane-periods">
        <div className="lane-label">תקופות</div>
        {periods.map((p, i) => (
          <div
            key={p.id}
            className={`period p${i % 2}`}
            style={{ left: yearToX(p.end, pxPerYear), width: (p.end - p.start) * pxPerYear }}
            title={`${p.name} · ${p.start}–${p.end}`}
          >
            <span>{p.name}</span>
          </div>
        ))}
      </div>

      {/* אירועים */}
      {visible.events && (
        <div className="lane lane-events" style={{ height: packedEvents.rows * 26 + 52 }}>
          <div className="lane-label">אירועים</div>
          {packedEvents.items.map((ev) => (
            <div
              key={ev.id}
              className={`event ${isSel('event', ev.id) ? 'selected' : ''}`}
              style={{ left: yearToX(ev.year, pxPerYear), top: ev.row * 26 + 22 }}
              onClick={() => onSelect({ ...ev, kind: 'event', start: ev.year, end: ev.year })}
              title={`${ev.name} · ${ev.year}`}
            >
              <span className="event-marker">◆</span>
              <span className="event-label">{ev.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* אבות ומנהיגים */}
      {visible.leaders && (
        <div className="lane lane-leaders" style={{ height: packedLeaders.rows * 30 + 32 }}>
          <div className="lane-label">אבות ומנהיגים</div>
          {packedLeaders.items.map((l) => (
            <Bar key={l.id} item={l} pxPerYear={pxPerYear} kind="leader" row={l.row}
              selected={isSel('leader', l.id)} onSelect={onSelect} />
          ))}
        </div>
      )}

      {/* מלכים */}
      {visible.kings && (
        <>
          <div className="lane lane-kings">
            <div className="lane-label">מלכים — הממלכה המאוחדת / יהודה</div>
            {kings.united.map((k) => (
              <Bar key={k.id} item={k} pxPerYear={pxPerYear} kind="united"
                selected={isSel('united', k.id)} onSelect={onSelect} />
            ))}
            {kings.judah.map((k) => (
              <Bar key={k.id} item={k} pxPerYear={pxPerYear} kind="judah"
                selected={isSel('judah', k.id)} onSelect={onSelect} />
            ))}
          </div>
          <div className="lane lane-kings">
            <div className="lane-label">מלכים — ממלכת ישראל</div>
            {kings.israel.map((k) => (
              <Bar key={k.id} item={k} pxPerYear={pxPerYear} kind="israel"
                selected={isSel('israel', k.id)} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}

      {/* נביאים */}
      {visible.prophets && (
        <div className="lane lane-prophets" style={{ height: packedProphets.rows * 30 + 32 }}>
          <div className="lane-label">נביאים</div>
          {packedProphets.items.map((p) => (
            <Bar key={p.id} item={p} pxPerYear={pxPerYear} kind="prophet" row={p.row}
              selected={isSel('prophet', p.id)} onSelect={onSelect} />
          ))}
        </div>
      )}

      {/* ספרים */}
      {visible.books && (
        <div className="lane lane-books" style={{ height: packedBooks.rows * 30 + 32 }}>
          <div className="lane-label">ספרי התנ"ך (התקופה המתוארת)</div>
          {packedBooks.items.map((b) => (
            <Bar key={b.id} item={b} pxPerYear={pxPerYear} kind="book" row={b.row}
              selected={isSel('book', b.id)} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
