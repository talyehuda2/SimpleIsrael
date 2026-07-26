import { useMemo, useState, useRef, useEffect } from 'react';

const KIND_LABEL = {
  leader: 'מנהיג', judge: 'שופט',
  united: 'מלך — מאוחדת', judah: 'מלך יהודה', israel: 'מלך ישראל',
  prophet: 'נביא', book: 'ספר', event: 'אירוע',
  world: 'רקע עולמי', empire: 'מלכות עולמית',
};

// כותרות הקבוצות בתוצאות — הפרדה בין התאמה ישירה, קשר-מקום וקשר-הקשר
const GROUP_LABEL = { 0: 'התאמה ישירה', 1: 'קשור למקום', 2: 'מוזכר בהקשר' };

// נרמול לחיפוש: הסרת ניקוד, גרשיים ורווחים כדי שההשוואה תהיה סלחנית
const norm = (s) => (s || '').replace(/[֑-ׇ"'׳״\s]/g, '');

export default function SearchBox({ index, onPick }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // התאמה רב-שכבתית: שם (מדויק ביותר) → מקום במסע → הקשר בתיאור.
  // כך "חברון" מציף את כל מי שעבר שם, ו"ברית" את מי שמופיע בהקשרו.
  const results = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    const scored = [];
    for (const it of index) {
      if (norm(it.name).includes(nq)) { scored.push({ it, rank: 0 }); continue; }
      const place = it.places && it.places.find((p) => norm(p).includes(nq));
      if (place) { scored.push({ it, rank: 1, place }); continue; }
      if (it.description && norm(it.description).includes(nq)) { scored.push({ it, rank: 2, theme: true }); }
    }
    scored.sort((a, b) => a.rank - b.rank || (a.it.start || 0) - (b.it.start || 0));
    return scored.slice(0, 14);
  }, [q, index]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (it) => { onPick(it); setQ(''); setOpen(false); };

  return (
    <div className="search-box" ref={boxRef}>
      <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
      </svg>
      <input
        type="search"
        value={q}
        placeholder="חיפוש דמות, מקום או נושא…"
        aria-label="חיפוש"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0].it);
          else if (e.key === 'Escape') { setQ(''); setOpen(false); e.currentTarget.blur(); }
        }}
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {[0, 1, 2].flatMap((rank) => {
            const group = results.filter((r) => r.rank === rank);
            if (!group.length) return [];
            return [
              <li key={`head-${rank}`} className="sr-head" aria-hidden="true">{GROUP_LABEL[rank]}</li>,
              ...group.map(({ it, place }) => (
                <li key={`${it.kind}-${it.id}`} className="sr-item" onClick={() => pick(it)}>
                  <span className={`sr-dot ${it.kind}`} />
                  <span className="sr-name">{it.name}</span>
                  {place && <span className="sr-why">📍 {place}</span>}
                  <span className="sr-kind">{KIND_LABEL[it.kind]}</span>
                </li>
              )),
            ];
          })}
        </ul>
      )}
      {open && q && results.length === 0 && (
        <ul className="search-results"><li className="sr-empty">אין תוצאות</li></ul>
      )}
    </div>
  );
}
