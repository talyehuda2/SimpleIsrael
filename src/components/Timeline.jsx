import { createContext, useContext, useMemo, useState } from 'react';
import { hebrewYearLetters, toSecular } from '../utils/dates.js';
import maps from '../data/maps.json';
import empires from '../data/empires.json';

// מונה התגובות לכל פריט ("kind:id" → מספר), מסופק דרך context
// כדי לא להעביר prop דרך כל אחת מקריאות <Bar>.
const CountsCtx = createContext({});

function CommentBadge({ n }) {
  if (!n) return null;
  return <span className="c-badge" title={`${n} תגובות`}>💬{n}</span>;
}

// ציר הזמן זורם מימין (עבר) לשמאל (הווה), כקריאה בעברית.
// x = מרחק מהקצה השמאלי = (endYear - שנה) * פיקסלים-לשנה.

export const START_YEAR = 1940;
export const END_YEAR = 3850;

// רצועה שמורה בקצה הימני (העתיק) של הציר, שבה יושבות תוויות השכבות (עמודה
// דביקה לימין המסך). הפריטים אינם נכנסים לרצועה זו, כדי שלא יוסתרו מאחורי התוויות.
export const LABEL_GUTTER_PX = 210;

// ריווח עליון בתוך כל רצועה — הפריטים לא נוגעים בקצה העליון של רצועת הרקע.
export const LANE_TOP_PAD = 8;

// גובה שורת רצועות-השליטה (מעצמות) בראש רצועת הרקע העולמי, שמתחתיה השליטים.
const EMPIRE_ROW_H = 30;

// גובה רצועה ממוזערת (מציגה רק את התווית)
const COLLAPSED_H = 26;

// תווית שכבה לחיצה — לחיצה ממזערת/מרחיבה את הרצועה
function LaneLabel({ text, laneKey, collapsed, onToggle }) {
  const c = !!collapsed[laneKey];
  return (
    <div className="lane-label" role="button" title={c ? 'הרחבת השכבה' : 'מזעור השכבה'}
      onClick={() => onToggle(laneKey)}>
      <span className="lane-caret" aria-hidden="true">{c ? '▸' : '▾'}</span>{text}
    </div>
  );
}
// מיפוי אימפריה → משתנה צבע, לצביעת רצועת השליטה דרך --band.
const POWER_VAR = { egypt: 'var(--pw-egypt)', assyria: 'var(--pw-assyria)', babylon: 'var(--pw-babylon)', persia: 'var(--pw-persia)', greece: 'var(--pw-greece)', rome: 'var(--pw-rome)' };

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

function Bar({ item, toX, pxPerYear, kind, mode, selected, onSelect, rowHeight = 30, row = 0, hl = '', topOffset = 0 }) {
  const left = toX(item.end);
  const width = Math.max((item.end - item.start) * pxPerYear, 6);
  const showLabel = width > 34;
  const showDot = width > 24;
  const nComments = useContext(CountsCtx)[`${kind}:${item.id}`] || 0;
  return (
    <div
      className={`bar ${kind} ${item.power ? 'pw-' + item.power : ''} ${hl} ${selected ? 'selected' : ''}`}
      style={{ left, width, top: row * rowHeight + LANE_TOP_PAD + topOffset }}
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
          <CommentBadge n={nComments} />
        </span>
      )}
    </div>
  );
}

export default function Timeline({
  pxPerYear, startYear = START_YEAR, endYear = END_YEAR, mode = 'tradition',
  gutter = LABEL_GUTTER_PX,
  periods, leaders, judges, kings, prophets, books, events, world = [],
  visible, selected, onSelect, highlightRange = null, commentCounts = {},
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
  const packedWorld = useMemo(() => packRows(world || []), [world]);
  const packedEvents = useMemo(() => {
    // אירועים נקודתיים — שיבוץ לפי מרחק תוויות כדי שלא יתנגשו, עם תקרת שורות.
    // מובייל: תקרה נמוכה כדי שרצועת האירועים לא תבלע את המסך ותסתיר את האנשים בטעינה.
    const sorted = [...events].sort((a, b) => b.year - a.year);
    const labelYears = 150 / pxPerYear; // רוחב משוער של תווית בשנים
    const maxRows = gutter <= 140 ? 4 : 8;
    const rowLast = [];
    const items = sorted.map((ev) => {
      let row = rowLast.findIndex((last) => last - ev.year >= labelYears);
      if (row === -1) {
        if (rowLast.length < maxRows) { row = rowLast.length; rowLast.push(Infinity); }
        else row = rowLast.indexOf(Math.max(...rowLast)); // השורה עם המרווח הגדול ביותר
      }
      rowLast[row] = ev.year;
      return { ...ev, row };
    });
    return { items, rows: rowLast.length };
  }, [events, pxPerYear, gutter]);

  const isSel = (kind, id) => selected && selected.kind === kind && selected.id === id;

  // מזעור רצועות: מפתח-רצועה → האם ממוזערת
  const [collapsed, setCollapsed] = useState({});
  const toggleLane = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  const laneH = (k, expanded) => (collapsed[k] ? COLLAPSED_H : expanded);
  const cx = (k) => (collapsed[k] ? ' collapsed' : '');

  return (
    <CountsCtx.Provider value={commentCounts}>
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
      <div className={`lane lane-periods${cx('periods')}`} style={{ height: laneH('periods', undefined) }}>
        <LaneLabel text="תקופות" laneKey="periods" collapsed={collapsed} onToggle={toggleLane} />
        {!collapsed.periods && periods.map((p, i) => (
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
        <div className={`lane lane-events${cx('events')}`} style={{ height: laneH('events', packedEvents.rows * 40 + 30 + LANE_TOP_PAD) }}>
          <LaneLabel text="אירועים" laneKey="events" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.events && packedEvents.items.map((ev) => (
            <div
              key={ev.id}
              className={`event ${hlOf(ev.year, ev.year)} ${isSel('event', ev.id) ? 'selected' : ''}`}
              style={{ left: toX(ev.year), top: ev.row * 40 + LANE_TOP_PAD }}
              onClick={() => onSelect({ ...ev, kind: 'event', start: ev.year, end: ev.year })}
              title={mode === 'academic' ? `${ev.name} · ${toSecular(ev.year)}` : `${ev.name} · ${ev.year}`}
            >
              <span className="event-marker">◆</span>
              <span className="event-label">
                {ev.name}
                <CommentBadge n={commentCounts[`event:${ev.id}`] || 0} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* אבות ומנהיגים */}
      {visible.leaders && leaders.length > 0 && (
        <div className={`lane lane-leaders${cx('leaders')}`} style={{ height: laneH('leaders', packedLeaders.rows * 30 + 10 + LANE_TOP_PAD) }}>
          <LaneLabel text="אבות ומנהיגים" laneKey="leaders" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.leaders && packedLeaders.items.map((l) => (
            <Bar key={l.id} item={l} toX={toX} pxPerYear={pxPerYear} kind="leader" mode={mode} row={l.row}
              selected={isSel('leader', l.id)} onSelect={onSelect} hl={hlOf(l.start, l.end)} />
          ))}
        </div>
      )}

      {/* שופטים */}
      {visible.judges && judges && judges.length > 0 && (
        <div className={`lane lane-judges${cx('judges')}`} style={{ height: laneH('judges', packedJudges.rows * 30 + 10 + LANE_TOP_PAD) }}>
          <LaneLabel text="שופטים" laneKey="judges" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.judges && packedJudges.items.map((j) => (
            <Bar key={j.id} item={j} toX={toX} pxPerYear={pxPerYear} kind="judge" mode={mode} row={j.row}
              selected={isSel('judge', j.id)} onSelect={onSelect} hl={hlOf(j.start, j.end)} />
          ))}
        </div>
      )}

      {/* מלכים */}
      {visible.kings && (
        <>
          <div className={`lane lane-kings lane-kings-judah${cx('kings-judah')}`} style={{ height: laneH('kings-judah', undefined) }}>
            <LaneLabel text="מלכים — הממלכה המאוחדת / יהודה" laneKey="kings-judah" collapsed={collapsed} onToggle={toggleLane} />
            {!collapsed['kings-judah'] && kings.united.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="united" mode={mode}
                selected={isSel('united', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
            {!collapsed['kings-judah'] && kings.judah.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="judah" mode={mode}
                selected={isSel('judah', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
          </div>
          <div className={`lane lane-kings lane-kings-israel${cx('kings-israel')}`} style={{ height: laneH('kings-israel', undefined) }}>
            <LaneLabel text="מלכים — ממלכת ישראל" laneKey="kings-israel" collapsed={collapsed} onToggle={toggleLane} />
            {!collapsed['kings-israel'] && kings.israel.map((k) => (
              <Bar key={k.id} item={k} toX={toX} pxPerYear={pxPerYear} kind="israel" mode={mode}
                selected={isSel('israel', k.id)} onSelect={onSelect} hl={hlOf(k.start, k.end)} />
            ))}
          </div>
        </>
      )}

      {/* נביאים */}
      {visible.prophets && (
        <div className={`lane lane-prophets${cx('prophets')}`} style={{ height: laneH('prophets', packedProphets.rows * 30 + 10 + LANE_TOP_PAD) }}>
          <LaneLabel text="נביאים" laneKey="prophets" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.prophets && packedProphets.items.map((p) => (
            <Bar key={p.id} item={p} toX={toX} pxPerYear={pxPerYear} kind="prophet" mode={mode} row={p.row}
              selected={isSel('prophet', p.id)} onSelect={onSelect} hl={hlOf(p.start, p.end)} />
          ))}
        </div>
      )}

      {/* ספרים */}
      {visible.books && (
        <div className={`lane lane-books${cx('books')}`} style={{ height: laneH('books', packedBooks.rows * 30 + 10 + LANE_TOP_PAD) }}>
          <LaneLabel text={'ספרי התנ"ך'} laneKey="books" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.books && packedBooks.items.map((b) => (
            <Bar key={b.id} item={b} toX={toX} pxPerYear={pxPerYear} kind="book" mode={mode} row={b.row}
              selected={isSel('book', b.id)} onSelect={onSelect} hl={hlOf(b.start, b.end)} />
          ))}
        </div>
      )}

      {/* רקע עולמי — רצועות השליטה של המעצמות + מלכים זרים המוזכרים במקרא */}
      {visible.world && world.length > 0 && (
        <div className={`lane lane-world${cx('world')}`} style={{ height: laneH('world', EMPIRE_ROW_H + packedWorld.rows * 30 + 10 + LANE_TOP_PAD) }}>
          <LaneLabel text="רקע עולמי" laneKey="world" collapsed={collapsed} onToggle={toggleLane} />
          {!collapsed.world && empires.map((e) => (
            <div
              key={e.id}
              className={`empire-band pw-${e.power} ${hlOf(e.start, e.end)} ${isSel('empire', e.id) ? 'selected' : ''}`}
              style={{ left: toX(e.end), width: (e.end - e.start) * pxPerYear, top: LANE_TOP_PAD, '--band': POWER_VAR[e.power] }}
              onClick={() => onSelect({ ...e, kind: 'empire' })}
              title={mode === 'academic' ? `${e.name} · ${toSecular(e.end)}` : `${e.name} · ${e.start}–${e.end}`}
            >
              <span>{e.name}</span>
            </div>
          ))}
          {!collapsed.world && packedWorld.items.map((w) => (
            <Bar key={w.id} item={w} toX={toX} pxPerYear={pxPerYear} kind="world" mode={mode} row={w.row}
              selected={isSel('world', w.id)} onSelect={onSelect} hl={hlOf(w.start, w.end)} topOffset={EMPIRE_ROW_H} />
          ))}
        </div>
      )}
    </div>
    </CountsCtx.Provider>
  );
}
