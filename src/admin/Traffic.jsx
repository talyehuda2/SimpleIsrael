/* לשונית "כניסות" - תנועה לאתר לאורך זמן, מתוך si_trail.
 *
 * הנתונים מגיעים מ-RPC אחד, admin_traffic, שמוודא את טוקן הניהול ומחזיר
 * ספירה לכל יום (שעון ישראל, כולל ימים ריקים). שום שורה גולמית לא יוצאת
 * מהמסד. הגרף נבנה ב-SVG ביד: ספריית גרפים הייתה מכפילה את משקל המסך בשביל
 * עמודה אחת.
 *
 * הזמן זורם מימין לשמאל, כמו בציר הזמן של האתר: היום המוקדם בימין.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

// שני הצבעים עברו את בודק הפלטה על --ad-panel: הבחנה לעיוורי צבעים
// (ΔE 23.5), ניגודיות 3:1 מול הרקע. הכחול הוא --judah של האתר; ה-navy
// של המסך כהה מדי לסימון נתונים ונקרא כאפור.
const C_OTHER = '#245c93';
const C_STATUS = '#a67f22';
const PRESETS = [7, 30, 90];

const iso = (d) => d.toISOString().slice(0, 10);
// "היום" לפי שעון ישראל ולא לפי שעון הטלפון - אחרת בחו"ל הטווח זז ביום
const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dayLabel = (s) => { const [, m, d] = s.split('-'); return `${+d}.${+m}`; };
const shortDate = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
const longDate = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' });

// קו רשת עגול: 0, 5, 10... ולא 0, 3.7, 7.4
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// עמודה שקצה הנתונים שלה מעוגל (4px) והבסיס שלה ישר
function colPath(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/* מקורות: src מהקישור קובע, ואם אין - הדומיין המפנה. השיוך לקבוצות כאן ולא
   ב-SQL (admin_sources.sql), כדי שמקור חדש לא ידרוש הרצה במסד. */
const SRC_LABEL = {
  status: 'סטטוס בוואטסאפ',
  channel: 'ערוץ הוואטסאפ',
  'card-share': 'שיתוף כרטיס',
  'game-share': 'שיתוף משחק',
  'reply-mail': 'מייל "ענו לך"',
  mail: 'מייל התראה אליך',
  game: 'מהמשחק',
};
const OTHER_SITES = 'אתרים אחרים';
function sourceOf(src, ref) {
  if (src) return SRC_LABEL[src] || `src=${src}`;
  if (!ref) return 'ישיר';
  if (/(^|\.)google\./.test(ref)) return 'גוגל';
  if (/(bing|duckduckgo|yahoo|yandex|ecosia)\./.test(ref)) return 'מנועי חיפוש אחרים';
  if (/(whatsapp|wa\.me)/.test(ref)) return 'וואטסאפ (בלי src)';
  if (/(facebook|fb\.|instagram|(^|\.)t\.co$|twitter|(^|\.)x\.com$|linkedin|tiktok|reddit|telegram)/.test(ref)) return 'רשתות חברתיות';
  return OTHER_SITES;
}

function Sources({ data }) {
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of data) {
      const k = sourceOf(r.src, r.ref);
      const g = m.get(k) || { label: k, n: 0, refs: new Map() };
      g.n += r.visits;
      if (r.ref) g.refs.set(r.ref, (g.refs.get(r.ref) || 0) + r.visits);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [data]);
  const total = groups.reduce((s, g) => s + g.n, 0);
  const max = Math.max(1, ...groups.map((g) => g.n));
  const others = groups.find((g) => g.label === OTHER_SITES);
  if (!total) return <p className="ad-note">אין כניסות בטווח הזה.</p>;
  return (
    <>
      <div className="ad-src">
        {groups.map((g) => (
          <div className="gm-bar" key={g.label}>
            <span className="gm-bar-l">{g.label}</span>
            <span className="gm-bar-t"><i style={{ width: `${(g.n / max) * 100}%` }} /></span>
            <span className="gm-bar-n">{g.n.toLocaleString('he-IL')} <small>{Math.round((g.n / total) * 100)}%</small></span>
          </div>
        ))}
      </div>
      {others && (
        <details className="ad-src-more">
          <summary>אילו אתרים</summary>
          <ul>
            {[...others.refs].sort((a, b) => b[1] - a[1]).map(([d, n]) => (
              <li key={d}><span dir="ltr">{d}</span> <small>{n}</small></li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/* ערוץ הוואטסאפ: מאיפה באתר לוחצים על הקישור (admin_channel.sql), ובכיוון
   ההפוך - כמה ביקורים הגיעו מהערוץ, מתוך admin_sources שכבר נטען */
const CH_FROM = { menu: 'תפריט "עוד באתר"', about: 'חלונית "אודות"', game: 'תוצאת האתגר היומי', board: 'טבלת המובילים' };

function Channel({ clicks, sources }) {
  const total = clicks.reduce((n, r) => n + r.clicks, 0);
  const max = Math.max(1, ...clicks.map((r) => r.clicks));
  const back = (sources || []).filter((r) => r.src === 'channel').reduce((n, r) => n + r.visits, 0);
  return (
    <>
      <p className="ad-lead">
        <b>{total.toLocaleString('he-IL')}</b> לחיצות על הקישור לערוץ
        {sources && <> · <b>{back.toLocaleString('he-IL')}</b> ביקורים הגיעו מהערוץ</>}
      </p>
      {total > 0 && (
        <div className="ad-src">
          {clicks.map((r) => (
            <div className="gm-bar" key={r.src}>
              <span className="gm-bar-l">{CH_FROM[r.src] || r.src}</span>
              <span className="gm-bar-t"><i style={{ width: `${(r.clicks / max) * 100}%` }} /></span>
              <span className="gm-bar-n">{r.clicks.toLocaleString('he-IL')}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* עומק ביקור: כמה דמויות ומקומות שונים נפתחו בביקור אחד (admin_engagement.sql).
   השאלה שהוא עונה עליה: נכנסים לכרטיס אחד ועוזבים, או ממשיכים? */
const DEPTH = [
  ['0', 'רק נכנסו'],
  ['1', 'כרטיס אחד'],
  ['2', 'שניים'],
  ['3-5', '3 עד 5'],
  ['6+', '6 ומעלה'],
];
function Engagement({ data }) {
  const [resolve, setResolve] = useState(null);
  useEffect(() => { import('../data/items.js').then((m) => setResolve(() => m.resolveKey)); }, []);
  const d = data.depth || {};
  const total = data.visits || 0;
  const max = Math.max(1, ...DEPTH.map(([k]) => d[k] || 0));
  const more = (d['2'] || 0) + (d['3-5'] || 0) + (d['6+'] || 0);
  const opened = total - (d['0'] || 0);
  if (!total) return <p className="ad-note">אין ביקורים בטווח הזה.</p>;
  return (
    <>
      <p className="ad-lead">
        <b>{Math.round((more / total) * 100)}%</b> מהביקורים פתחו יותר מכרטיס אחד
        {opened > 0 && <> · מתוך מי שפתח כרטיס, <b>{Math.round((more / opened) * 100)}%</b> המשיכו לעוד</>}
      </p>
      <div className="ad-src">
        {DEPTH.map(([k, label]) => (
          <div className="gm-bar" key={k}>
            <span className="gm-bar-l">{label}</span>
            <span className="gm-bar-t"><i style={{ width: `${((d[k] || 0) / max) * 100}%` }} /></span>
            <span className="gm-bar-n">{(d[k] || 0).toLocaleString('he-IL')} <small>{Math.round(((d[k] || 0) / total) * 100)}%</small></span>
          </div>
        ))}
      </div>
      <div className="ad-top">
        <div>
          <h4>הדמויות והאירועים שהכי נפתחו</h4>
          <ol>
            {(data.items || []).map((x) => (
              <li key={x.key}><span>{resolve?.(x.key)?.name || x.key}</span> <small>{x.n}</small></li>
            ))}
          </ol>
        </div>
        {(data.places || []).length > 0 && (
          <div>
            <h4>המקומות שהכי נפתחו</h4>
            <ol>
              {data.places.map((x) => <li key={x.id}><span>{x.id}</span> <small>{x.n}</small></li>)}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}

function Chart({ rows }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(360);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 220, padT = 12, padB = 26, padL = 8, padR = 34;
  const plotW = width - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(0, ...rows.map((r) => r.visits)));
  const band = plotW / Math.max(1, rows.length);
  const colW = Math.max(2, Math.min(24, band * 0.72));
  const y = (v) => padT + plotH - (v / max) * plotH;
  // מימין לשמאל: אינדקס 0 (המוקדם) בקצה הימני
  const xCenter = (i) => padL + plotW - (i + 0.5) * band;
  // קו אמצעי רק כשהוא מספר שלם - "12.5 ביקורים" אינו ערך אפשרי
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  const labelEvery = Math.ceil(rows.length / Math.max(2, Math.floor(plotW / 46)));

  return (
    <div className="ad-chart" ref={wrapRef}>
      <svg width={width} height={H} role="img" aria-label="כניסות לאתר לפי יום">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={padL + plotW} y1={y(t)} y2={y(t)} className="ad-grid" />
            <text x={width - 4} y={y(t) + 4} className="ad-axis" textAnchor="end">{t}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = xCenter(i) - colW / 2;
          const status = r.from_status;
          const other = r.visits - status;
          // 2px ברקע בין שני המקטעים - הרווח הוא שמפריד, לא קו מסביב
          const gap = status > 0 && other > 0 ? 2 : 0;
          const hS = (status / max) * plotH;
          const hO = Math.max(0, (other / max) * plotH - gap);
          return (
            <g key={r.day} opacity={hover === null || hover === i ? 1 : 0.55}>
              {status > 0 && (
                other > 0
                  ? <rect x={x} y={y(status)} width={colW} height={hS} fill={C_STATUS} />
                  : <path d={colPath(x, y(status), colW, hS, 4)} fill={C_STATUS} />
              )}
              {other > 0 && <path d={colPath(x, y(r.visits), colW, hO, 4)} fill={C_OTHER} />}
            </g>
          );
        })}
        {rows.map((r, i) => (i % labelEvery === 0 ? (
          <text key={r.day} x={xCenter(i)} y={H - 8} className="ad-axis" textAnchor="middle">{dayLabel(r.day)}</text>
        ) : null))}
        {/* יעד מגע ברוחב כל הרצועה ובגובה כל הגרף: אצבע לא מכוונת לעמודה של 6px */}
        {rows.map((r, i) => (
          <rect
            key={r.day} x={xCenter(i) - band / 2} y={padT} width={band} height={plotH}
            fill="transparent" tabIndex={0}
            onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}
            onFocus={() => setHover(i)} onPointerLeave={() => setHover(null)} onBlur={() => setHover(null)}
          />
        ))}
      </svg>
      {hover !== null && rows[hover] && (
        <div
          className="ad-tip"
          style={{ left: `${Math.min(width - 150, Math.max(0, xCenter(hover) - 75))}px` }}
        >
          <div className="ad-tip-day">{longDate(rows[hover].day)}</div>
          <div><b>{rows[hover].visits}</b> ביקורים</div>
          <div><i style={{ background: C_STATUS }} /> <b>{rows[hover].from_status}</b> מהסטטוס</div>
        </div>
      )}
    </div>
  );
}

export default function Traffic({ token, onBadToken }) {
  const today = todayIL();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  // null = הפונקציה עוד לא הורצה במסד; הלשונית עובדת גם בלעדיה
  const [sources, setSources] = useState([]);
  const [engagement, setEngagement] = useState({});
  const [channel, setChannel] = useState([]);

  const load = useCallback(async () => {
    setStatus('loading'); setErr('');
    supabase.rpc('admin_sources', { p_token: token, p_from: from, p_to: to })
      .then(({ data, error }) => setSources(error ? null : (data || [])));
    supabase.rpc('admin_engagement', { p_token: token, p_from: from, p_to: to })
      .then(({ data, error }) => setEngagement(error ? null : (data || {})));
    supabase.rpc('admin_channel', { p_token: token, p_from: from, p_to: to })
      .then(({ data, error }) => setChannel(error ? null : (data || [])));
    const { data, error } = await supabase.rpc('admin_traffic', { p_token: token, p_from: from, p_to: to });
    if (error) {
      const msg = error.message || '';
      if (/טוקן/.test(msg)) { onBadToken(); return; }
      setErr(error.code === 'PGRST202' || /admin_traffic/.test(msg)
        ? 'הפונקציה admin_traffic אינה קיימת. להריץ את supabase/admin_traffic.sql ב-Supabase.'
        : (msg || 'שגיאה בטעינה'));
      setStatus('error');
      return;
    }
    setRows((data || []).map((r) => ({ ...r, day: String(r.day).slice(0, 10) })));
    setStatus('ready');
  }, [token, from, to, onBadToken]);

  useEffect(() => { load(); }, [load]);

  const preset = (n) => { setFrom(addDays(today, -(n - 1))); setTo(today); };
  const activePreset = to === today ? PRESETS.find((n) => from === addDays(today, -(n - 1))) : null;

  const sum = useMemo(() => {
    const visits = rows.reduce((s, r) => s + r.visits, 0);
    const st = rows.reduce((s, r) => s + r.from_status, 0);
    const peak = rows.reduce((b, r) => (r.visits > (b?.visits ?? -1) ? r : b), null);
    return { visits, status: st, avg: rows.length ? visits / rows.length : 0, peak };
  }, [rows]);

  return (
    <main className="ad-list">
      <div className="ad-range">
        <div className="ad-presets" role="group" aria-label="טווח">
          {PRESETS.map((n) => (
            <button key={n} className={activePreset === n ? 'on' : ''} onClick={() => preset(n)}>{n} ימים</button>
          ))}
        </div>
        <div className="ad-dates">
          <label>מ־<input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
          <label>עד<input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        </div>
      </div>

      {status === 'loading' && <p className="ad-msg">טוען…</p>}
      {status === 'error' && <p className="ad-msg ad-err">{err}</p>}

      {status === 'ready' && (
        <>
          <div className="ad-stats">
            <div className="ad-stat"><span>ביקורים</span><b>{sum.visits.toLocaleString('he-IL')}</b></div>
            <div className="ad-stat"><span>מהסטטוס</span><b>{sum.status.toLocaleString('he-IL')}</b></div>
            <div className="ad-stat"><span>ממוצע ליום</span><b>{sum.avg.toLocaleString('he-IL', { maximumFractionDigits: 1 })}</b></div>
            <div className="ad-stat"><span>היום העמוס</span><b>{sum.peak && sum.peak.visits > 0 ? shortDate(sum.peak.day) : '—'}</b></div>
          </div>

          <section className="ad-card ad-chart-card">
            <div className="ad-legend">
              <span><i style={{ background: C_OTHER }} /> כניסות אחרות</span>
              <span><i style={{ background: C_STATUS }} /> מהסטטוס</span>
            </div>
            <Chart rows={rows} />
            <p className="ad-note">
              ביקור הוא טאב אחד שבו נטען מסך באתר. עמודי השער (<code dir="ltr">/p/…</code>) אינם
              נספרים, ו״מהסטטוס״ נספר רק מקישורים עם <code dir="ltr">src=status</code>.
            </p>
          </section>

          <section className="ad-card">
            <h3>מאיפה מגיעים</h3>
            {sources === null
              ? <p className="ad-note">כדי לראות את הפירוט צריך להריץ את <code dir="ltr">supabase/admin_sources.sql</code> ב-Supabase.</p>
              : <Sources data={sources} />}
            <p className="ad-note">
              כל ביקור נספר פעם אחת, לפי הכניסה הראשונה שלו. "ישיר" כולל גם קישור שנשלח בוואטסאפ
              בלי סימון מקור - וואטסאפ לא מספר לאתר מאיפה הגיעו.
            </p>
          </section>

          <section className="ad-card">
            <h3>עומק ביקור</h3>
            {engagement === null
              ? <p className="ad-note">כדי לראות את הנתון צריך להריץ את <code dir="ltr">supabase/admin_engagement.sql</code> ב-Supabase.</p>
              : <Engagement data={engagement} />}
            <p className="ad-note">
              כמה דמויות ומקומות שונים נפתחו בביקור אחד. "רק נכנסו" - העמוד נטען ולא נפתח בו כרטיס.
              במסע הדורות נספרים כרטיסים רק מאוקטובר 2026, ונספר כרטיס שנלחץ - לא כזה שהגלילה עברה לידו.
            </p>
          </section>

          <section className="ad-card">
            <h3>ערוץ הוואטסאפ</h3>
            {channel === null
              ? <p className="ad-note">כדי לראות את הנתון צריך להריץ את <code dir="ltr">supabase/admin_channel.sql</code> ב-Supabase.</p>
              : <Channel clicks={channel} sources={sources} />}
            <p className="ad-note">
              לחיצות על הקישור לערוץ, לפי המקום באתר. לחיצה אינה הצטרפות - את מספר העוקבים רואים
              בוואטסאפ. "הגיעו מהערוץ" - ביקורים מקישור עם <code dir="ltr">src=channel</code>.
            </p>
          </section>

          <details className="ad-card ad-table">
            <summary>טבלה לפי יום</summary>
            <table>
              <thead><tr><th>יום</th><th>ביקורים</th><th>מהסטטוס</th><th>ציר הזמן</th><th>מסע הדורות</th><th>מפת הארץ</th></tr></thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.day}>
                    <td>{longDate(r.day)}</td><td>{r.visits}</td><td>{r.from_status}</td>
                    <td>{r.timeline}</td><td>{r.atlas}</td><td>{r.places}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </main>
  );
}
