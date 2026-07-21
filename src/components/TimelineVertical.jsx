import { useMemo } from 'react';
import { formatRange } from '../utils/dates.js';
import maps from '../data/maps.json';

// "זרם כרונולוגי" למובייל — כל פריט בשורה ברוחב מלא, בסדר כרונולוגי מדויק.
// ויתרנו על אורך פרופורציונלי (בלתי אפשרי ברוחב טלפון: עד 14 פריטים חופפים
// בו-זמנית), ובמקומו יש פס דק שמראה את משך הזמן היחסי.

const KIND_LABEL = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך — הממלכה המאוחדת',
  judah: 'מלך יהודה', israel: 'מלך ישראל', prophet: 'נביא',
  book: 'ספר', world: 'רקע עולמי', event: 'אירוע',
};

export default function TimelineVertical({
  startYear, endYear, mode = 'tradition',
  periods = [], leaders = [], judges = [], kings = {}, prophets = [], books = [], events = [], world = [],
  visible, selected, onSelect, highlightRange = null, commentCounts = {},
}) {
  const hlOf = (s, e) => {
    if (!highlightRange) return '';
    const { start, end } = highlightRange;
    let overlap;
    if (s === e) overlap = s >= start && s <= end;
    else if (start === end) overlap = start >= s && start <= e;
    else overlap = s < end && e > start;
    return overlap ? ' contemporary' : ' dimmed';
  };

  const items = useMemo(() => {
    const out = [];
    const add = (arr, kind) => (arr || []).forEach((x) => out.push({ ...x, kind }));
    if (visible.leaders) add(leaders, 'leader');
    if (visible.judges) add(judges, 'judge');
    if (visible.kings) { add(kings.united, 'united'); add(kings.judah, 'judah'); add(kings.israel, 'israel'); }
    if (visible.prophets) add(prophets, 'prophet');
    if (visible.books) add(books, 'book');
    if (visible.world) add(world, 'world');
    if (visible.events) (events || []).forEach((e) => out.push({ ...e, kind: 'event', start: e.year, end: e.year }));
    return out.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name, 'he'));
  }, [leaders, judges, kings, prophets, books, world, events, visible]);

  const maxSpan = useMemo(
    () => Math.max(1, ...items.map((i) => i.end - i.start)),
    [items]
  );

  // חלוקה לקטעים לפי תקופה — כותרת דביקה שנותנת הקשר בזמן הגלילה
  const sections = useMemo(() => {
    const eras = (periods || []).filter((p) => p.end > startYear && p.start < endYear);
    const out = eras.map((p) => ({ era: p, list: [] }));
    const rest = [];
    for (const it of items) {
      const s = out.find(({ era }) => it.start >= era.start && it.start < era.end)
        || out.find(({ era }) => it.start >= era.start && it.start <= era.end);
      if (s) s.list.push(it); else rest.push(it);
    }
    if (rest.length) out.push({ era: null, list: rest });
    return out.filter((s) => s.list.length);
  }, [items, periods, startYear, endYear]);

  return (
    <div className="vstream">
      {sections.map(({ era, list }) => (
        <section key={era ? era.id : 'other'} className="vsec">
          {era && (
            <h2 className="vsec-head">
              <span className="vsec-name">{era.name}</span>
              <span className="vsec-years">{era.start}–{era.end}</span>
            </h2>
          )}
          {list.map((it) => {
            const span = it.end - it.start;
            const isEvent = it.kind === 'event';
            const n = commentCounts[`${it.kind}:${it.id}`] || 0;
            const isSel = selected && selected.kind === it.kind && selected.id === it.id;
            return (
              <button
                key={`${it.kind}:${it.id}`}
                type="button"
                data-key={`${it.kind}:${it.id}`}
                className={`vrow ${it.kind}${it.power ? ' pw-' + it.power : ''}${hlOf(it.start, it.end)}${isSel ? ' selected' : ''}`}
                onClick={() => onSelect({ ...it })}
              >
                <span className="vrow-main">
                  <span className="vrow-name">
                    {isEvent && <span aria-hidden="true">◆ </span>}
                    {it.name}
                    {maps[it.id] && <span className="vrow-pin" aria-hidden="true"> 📍</span>}
                    {n > 0 && <span className="c-badge">💬{n}</span>}
                  </span>
                  <span className="vrow-meta">
                    {formatRange(it.start, it.end, mode)} · {KIND_LABEL[it.kind]}
                  </span>
                  {!isEvent && span > 0 && (
                    <span className="vrow-track">
                      <span className="vrow-fill" style={{ width: `${Math.max(4, (span / maxSpan) * 100)}%` }} />
                    </span>
                  )}
                </span>
                {it.judgment && <span className={`vrow-dot ${it.judgment}`} aria-hidden="true" />}
              </button>
            );
          })}
        </section>
      ))}
      {!items.length && <p className="vstream-empty">לא נבחרו שכבות להצגה — פתחו את "אפשרויות" וסמנו שכבות.</p>}
    </div>
  );
}
