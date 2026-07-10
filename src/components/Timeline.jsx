import { useMemo } from 'react';
import { hebrewYearLetters, toSecular } from '../utils/dates.js';
import maps from '../data/maps.json';

// ציר הזמן זורם מימין (עבר) לשמאל (הווה), כקריאה בעברית.
// x = מרחק מהקצה השמאלי = (endYear - שנה) * פיקסלים-לשנה.

export const START_YEAR = 1940;
export const END_YEAR = 3850;

// רצועה שמורה בקצה הימני (העתיק) של הציר, שבה יושבות תוויות השכבות (עמודה
// דביקה לימין המסך). הפריטים אינם נכנסים לרצועה זו, כדי שלא יוסתרו מאחורי התוויות.
export const LABEL_GUTTER_PX = 210;

// ריווח עליון בתוך כל רצועה — הפריטים לא נוגעים בקצה העליון של רצועת הרקע.
export const LANE_TOP_PAD = 8;

export function yearToX(year, pxPerYear, endYear = END_YEAR) {
  return (endYear - year) * pxPerYear;
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
  // בוחר צעד כך שהמרווח בין תוויות לא יקטן מ-MIN_GAP פיקסלים — מונע חפיפת תאריכים
  const MIN_GAP = 74;
  const steps = [10, 25, 50, 100, 200, 250, 500, 1000, 2000];
  for (const s of steps) if (s * pxPerYear >= MIN_GAP) return s;
  return 2000;
}

function barTitle(item, mode) {
  return mode === 'academic'
    ? `${item.name} · ${toSecular(item.start)}–${toSecular(item.end)}`
    : `${item.name} · ${item.start}–${item.end}`;
}

function Bar({ item, toX, pxPerYear, kind, mode, selected, onSelect, rowHeight = 30, row = 0, hl = '' }) {
  const left = toX(item.end);
  const width = Math.max((item.end - item.start) * pxPerYear, 6);
  const showLabel = width > 34;
  const showDot = width > 24;
  return (
    <div
      className={`bar ${kind} ${hl} ${selected ? 'selected' : ''}`}
      style={{ left, width, top: row * rowHeight + LANE_TOP_PAD }}
      title={barTitle(item, mode)}
      onClick={() => onSelect({ ...item, kind })}
    >
      {item.judgment && showDot && <span className={`dot ${item.judgment}`} />}
      {showLabel && (
        <span className="bar-label">
          {item.name}
          {maps[item.id] && (
            <svg className="bar-mapicon" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
              <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
          )}
        </span>
      )}
    </div>
  );
}

export default function Timeline({
  pxPerYear, startYear = START_YEAR, endYear = END_YEAR, mode = 'tradition',
  gutter = LABEL_GUTTER_PX,
  periods, leaders, judges, kings, prophets, books, events,
  visible, selected, onSelect, highlightRange = null,
}) {
  const totalWidth = (endYear - startYear) * pxPerYear + gutter;
  const toX = (year) => (endYear - year) * pxPerYear;

  // מצב "בני-הזמן": מסמן כל פריט כחופף (contemporary) או לא-חופף (dimmed) לטווח הנבחר.
  // אירוע נקודתי (s===e) נכלל אם הוא בתוך הטווח כולל הגבולות — כך פילוג המלוכה מסומן
  // כשבוחרים את רחבעם/ירבעם שמלכותם מתחילה בדיוק באותה שנה. שני טווחים דורשים חפיפה
  // אמיתית (אי-שוויון חמור) — כדי ששכן צמוד ברצף מלוכה שרק "נוגע" בגבול לא ייחשב בן-זמן.
  const hlOf = (s, e) => {
    if (!highlightRange) return '';
    const { start, end } = highlightRange;
    let overlap;
    if (s === e) overlap = s >= start && s <= end;              // נקודה נבדקת
    else if (start === end) overlap = start >= s && start <= e;  // הנבחר הוא אירוע נקודתי
    else overlap = s < end && e > start;                        // טווח מול טווח
    return overlap ? 'contemporary' : 'dimmed';
  };

  const ticks = useMemo(() => {
    const step = tickStep(pxPerYear);
    const list = [];
    for (let y = Math.ceil(startYear / step) * step; y <= endYear; y += step) list.push(y);
    return list;
  }, [pxPerYear, startYear, endYear]);

  const packedLeaders = useMemo(() => packRows(leaders), [leaders]);
  const packedJudges = useMemo(() => packRows(judges || []), [judges]);
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
          <div key={y} className="tick" style={{ left: toX(y) }}>
            {mode !== 'academic' && <div className="tick-heb">{hebrewYearLetters(y)}</div>}
            {mode !== 'academic' && <div className="tick-num">{y}</div>}
            <div className="tick-sec">{toSecular(y)}</div>
          </div>
        ))}
      </div>
      {ticks.map((y) => (
        <div key={y} className="gridline" style={{ left: toX(y) }} />
      ))}

      {/* תקופות */}
      <div className="lane lane-periods">
        <div className="lane-label">תקופות</div>
        {periods.map((p, i) => (
          <div
            key={p.id}
            className={`period p${i % 2} ${hlOf(p.start, p.end)}`}
            style={{ left: toX(p.end), width: (p.end - p.start) * pxPerYear }}
            title={barTitle(p, mode)}
          >
            <span>{p.name}</span>
          </div>
        ))}
      </div>

      {/* אירועים */}
      {visible.events && (
        <div className="lane lane-events" style={{ height: packedEvents.rows * 40 + 30 + LANE_TOP_PAD }}>
          <div className="lane-label">אירועים</div>
          {packedEvents.items.map((ev) => (
            <div
              key={ev.id}
              className={`event ${hlOf(ev.year, ev.year)} ${isSel('event', ev.id) ? 'selected' : ''}`}
              style={{ left: toX(ev.year), top: ev.row * 40 + LANE_TOP_PAD }}
              onClick={() => onSelect({ ...ev, kind: 'event', start: ev.year, end: ev.year })}
              title={mode === 'academic' ? `${ev.name} · ${toSecular(ev.year)}` : `${ev.name} · ${ev.year}`}
            >
              <span className="event-marker">◆</span>
              <span className="event-label">{ev.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* אבות ומנהיגים */}
      {visible.leaders && leaders.length > 0 && (
        <div className="lane lane-leaders" style={{ height: packedLeaders.rows * 30 + 10 + LANE_TOP_PAD }}>
          <div className="lane-label">אבות ומנהיגים</div>
          {packedLeaders.items.map((l) => (
            <Bar key={l.id} item={l} toX={toX} pxPerYear={pxPerYear} kind="leader" mode={mode} row={l.row}
              selected={isSel('leader', l.id)} onSelect={onSelect} hl={hlOf(l.start, l.end)} />
          ))}
        </div>
      )}

      {/* שופטים */}
      {visible.judges && judges && judges.length > 0 && (
        <div className="lane lane-judges" style={{ height: packedJudges.rows * 30 + 10 + LANE_TOP_PAD }}>
          <div className="lane-label">שופטים</div>
          {packedJudges.items.map((j) => (
            <Bar key={j.id} item={j} toX={toX} pxPerYear={pxPerYear} kind="judge" mode={mode} row={j.row}
              selected={isSel('judge', j.id)} onSelect={onSelect} hl={hlOf(j.start, j.end)} />
          ))}
        </div>
      )}

      {/* מלכים */}
      {visible.kings && (
        <>
          <div className="lane lane-kings lane-kings-judah">
            <div className="lane-label">מלכים — הממלכה המאוחדת / יהודה</div>
            {kings.united.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="united" mode={mode}
                selected={isSel('united', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
            {kings.judah.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="judah" mode={mode}
                selected={isSel('judah', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
          </div>
          <div className="lane lane-kings lane-kings-israel">
            <div className="lane-label">מלכים — ממלכת ישראל</div>
            {kings.israel.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="israel" mode={mode}
                selected={isSel('israel', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
          </div>
        </>
      )}

      {/* נביאים */}
      {visible.prophets && (
        <div className="lane lane-prophets" style={{ height: packedProphets.rows * 30 + 10 + LANE_TOP_PAD }}>
          <div className="lane-label">נביאים</div>
          {packedProphets.items.map((p) => (
            <Bar key={p.id} item={p} toX={toX} pxPerYear={pxPerYear} kind="prophet" mode={mode} row={p.row}
              selected={isSel('prophet', p.id)} onSelect={onSelect} hl={hlOf(p.start, p.end)} />
          ))}
        </div>
      )}

      {/* ספרים */}
      {visible.books && (
        <div className="lane lane-books" style={{ height: packedBooks.rows * 30 + 10 + LANE_TOP_PAD }}>
          <div className="lane-label">ספרי התנ"ך</div>
          {packedBooks.items.map((b) => (
            <Bar key={b.id} item={b} toX={toX} pxPerYear={pxPerYear} kind="book" mode={mode} row={b.row}
              selected={isSel('book', b.id)} onSelect={onSelect} hl={hlOf(b.start, b.end)} />
          ))}
        </div>
      )}
    </div>
  );
}
