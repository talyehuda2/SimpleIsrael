import { useEffect, useMemo } from 'react';
import kings from '../data/kings.json';
import prophets from '../data/prophets.json';
import judges from '../data/judges.json';
import leaders from '../data/leaders.json';
import events from '../data/events.json';
import books from '../data/books.json';
import world from '../data/world.json';
import { toSecular } from '../utils/dates.js';

// כל התובנות מחושבות מהנתונים עצמם — אין מספרים קבועים בקוד.
function compute() {
  const realm = (arr) => {
    const g = arr.filter((k) => k.judgment === 'good').length;
    const m = arr.filter((k) => k.judgment === 'mixed').length;
    const b = arr.filter((k) => k.judgment === 'bad').length;
    return { total: arr.length, g, m, b };
  };
  const judah = realm(kings.judah);
  const israel = realm(kings.israel);

  const withRealm = [
    ...kings.judah.map((k) => ({ ...k, realm: 'יהודה' })),
    ...kings.israel.map((k) => ({ ...k, realm: 'ישראל' })),
    ...kings.united.map((k) => ({ ...k, realm: 'המאוחדת' })),
  ].map((k) => ({ ...k, dur: k.end - k.start }));

  const longest = [...withRealm].sort((a, b) => b.dur - a.dur).slice(0, 6);
  const shortest = withRealm.filter((k) => k.dur === 0);
  const avg = (arr) => Math.round((arr.reduce((s, k) => s + (k.end - k.start), 0) / arr.length) * 10) / 10;

  // צפיפות נביאים לאורך זמן (דלי של 20 שנה) + השיא
  const START = 2820, END = 3460, STEP = 20;
  const density = [];
  let peak = { n: 0, year: 0 };
  for (let y = START; y <= END; y += STEP) {
    const n = prophets.filter((p) => p.start <= y && p.end >= y).length;
    density.push({ y, n });
    if (n > peak.n) peak = { n, year: y };
  }
  const maxDensity = Math.max(...density.map((d) => d.n));

  const counts = {
    מלכים: kings.judah.length + kings.israel.length + kings.united.length,
    נביאים: prophets.length,
    שופטים: judges.length,
    'אבות ומנהיגים': leaders.length,
    אירועים: events.length,
    'ספרי תנ״ך': books.length,
    'רקע עולמי': world.length,
  };

  // ספרי תנ״ך לפי טווח השנים שהם מכסים
  const longestBooks = books
    .map((b) => ({ ...b, span: b.end - b.start }))
    .sort((a, b) => b.span - a.span)
    .slice(0, 6);

  // הנביאים עם הקריירה הארוכה ביותר
  const longestProphets = prophets
    .map((p) => ({ ...p, span: p.end - p.start }))
    .sort((a, b) => b.span - a.span)
    .slice(0, 6);

  return {
    judah, israel,
    avgJudah: avg(kings.judah), avgIsrael: avg(kings.israel),
    longest, shortest, density, maxDensity, peak, counts,
    longestBooks, longestProphets,
  };
}

function JudgmentBar({ label, data, avg }) {
  const seg = (n, cls) => n > 0 && (
    <span className={`ins-seg ${cls}`} style={{ flex: n }} title={`${n}`}>{n}</span>
  );
  return (
    <div className="ins-jrow">
      <div className="ins-jhead">
        <span className="ins-jlabel">{label}</span>
        <span className="ins-javg">ממוצע מלוכה {avg} שנה</span>
      </div>
      <div className="ins-jbar">
        {seg(data.g, 'good')}
        {seg(data.m, 'mixed')}
        {seg(data.b, 'bad')}
      </div>
    </div>
  );
}

export default function Insights({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const s = useMemo(compute, []);
  if (!open) return null;
  const maxDur = s.longest[0].dur;
  const maxBook = s.longestBooks[0].span;
  const maxProph = s.longestProphets[0].span;

  return (
    <div className="ins-overlay" onClick={onClose}>
      <div className="ins-panel" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="ins-title">תובנות מציר הזמן</h2>
        <p className="ins-sub">נתונים שחושבו מכלל הדמויות והאירועים — מבט-על שלא רואים בקריאה רגילה.</p>

        {/* מלכים: הישר מול הרע */}
        <section className="ins-card">
          <h3>המלכים — הישר מול הרע</h3>
          <JudgmentBar label="מלכי יהודה" data={s.judah} avg={s.avgJudah} />
          <JudgmentBar label="מלכי ישראל" data={s.israel} avg={s.avgIsrael} />
          <div className="ins-legend">
            <span><i className="d good" /> עשה הישר</span>
            <span><i className="d mixed" /> מעורב</span>
            <span><i className="d bad" /> עשה הרע</span>
          </div>
          <p className="ins-punch">
            אף אחד מ־{s.israel.total} מלכי ישראל לא נשפט כ״עשה הישר בעיני ה׳״ — לעומת {s.judah.g} מלכים ביהודה.
          </p>
        </section>

        {/* מלוכות ארוכות */}
        <section className="ins-card">
          <h3>המלוכות הארוכות ביותר</h3>
          {s.longest.map((k) => (
            <div key={`${k.realm}:${k.name}`} className="ins-lrow">
              <span className="ins-lname">{k.name} <span className="ins-lrealm">({k.realm})</span></span>
              <span className="ins-ltrack">
                <span className={`ins-lfill ${k.judgment || ''}`} style={{ width: `${(k.dur / maxDur) * 100}%` }} />
              </span>
              <span className="ins-lyears">{k.dur}</span>
            </div>
          ))}
          <p className="ins-punch">
            {s.longest[0].name} מלך {s.longest[0].dur} שנה — הארוך בהיסטוריה — ובכל זאת נשפט כ״עשה הרע״.
          </p>
        </section>

        {/* צפיפות נביאים */}
        <section className="ins-card">
          <h3>צפיפות הנבואה</h3>
          <div className="ins-density">
            {s.density.map((d) => (
              <span
                key={d.y}
                className="ins-dbar"
                style={{ height: `${(d.n / s.maxDensity) * 100}%` }}
                title={`${d.n} נביאים · ${d.y}`}
              />
            ))}
          </div>
          <div className="ins-drange"><span>{toSecular(2820)}</span><span>{toSecular(3460)}</span></div>
          <p className="ins-punch">
            השיא: {s.peak.n} נביאים פעילים בו-זמנית סביב שנת {s.peak.year} ({toSecular(s.peak.year)}) — ערב חורבן בית ראשון.
          </p>
        </section>

        {/* ספרים לפי כיסוי */}
        <section className="ins-card">
          <h3>הספרים המקיפים ביותר</h3>
          {s.longestBooks.map((b) => (
            <div key={b.id} className="ins-lrow">
              <span className="ins-lname">{b.name}</span>
              <span className="ins-ltrack">
                <span className="ins-lfill book" style={{ width: `${(b.span / maxBook) * 100}%` }} />
              </span>
              <span className="ins-lyears">{b.span}</span>
            </div>
          ))}
          <p className="ins-punch">
            {s.longestBooks[0].name} פורש על פני {s.longestBooks[0].span} שנה — מבריאת העולם ועד שיבת ציון.
          </p>
        </section>

        {/* קריירות נבואיות ארוכות */}
        <section className="ins-card">
          <h3>הקריירות הנבואיות הארוכות</h3>
          {s.longestProphets.map((p) => (
            <div key={p.id} className="ins-lrow">
              <span className="ins-lname">{p.name}</span>
              <span className="ins-ltrack">
                <span className="ins-lfill prophet" style={{ width: `${(p.span / maxProph) * 100}%` }} />
              </span>
              <span className="ins-lyears">{p.span}</span>
            </div>
          ))}
        </section>

        {/* במספרים */}
        <section className="ins-card">
          <h3>במספרים</h3>
          <div className="ins-counts">
            {Object.entries(s.counts).map(([label, n]) => (
              <div key={label} className="ins-count"><b>{n}</b><span>{label}</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
