/* לשונית "משחק" - "סדר את הציר" במספרים: כמה שיחקו, מה הציון הממוצע, איפה
   טועים וכמה שיתפו. הכל מ-RPC אחד, admin_game (supabase/admin_game.sql), שמוודא
   את טוקן הניהול ומחזיר סיכומים בלבד.

   "איפה טועים" מחלק טעויות בהופעות: פריט שנכשל 3 פעמים מתוך 4 קשה יותר מפריט
   שנכשל 5 פעמים מתוך 40. שורות עם פחות מ-3 הופעות לא נכנסות - שם אחוז הוא רעש. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const PRESETS = [7, 30, 90];
const MIN_SEEN = 3;
const iso = (d) => d.toISOString().slice(0, 10);
const todayIL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const longDate = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'long' });
const fmt = (v, digits = 1) => (v == null ? '—' : Number(v).toLocaleString('he-IL', { maximumFractionDigits: digits }));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export default function Game({ token, onBadToken }) {
  const today = todayIL();
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  // שמות הפריטים: הנתונים כבדים, ולכן נטענים רק כשהלשונית נפתחת
  const [resolve, setResolve] = useState(null);
  useEffect(() => { import('../data/items.js').then((m) => setResolve(() => m.resolveKey)); }, []);

  const load = useCallback(async () => {
    setStatus('loading'); setErr('');
    const { data: d, error } = await supabase.rpc('admin_game', { p_token: token, p_from: from, p_to: to });
    if (error) {
      const msg = error.message || '';
      if (/טוקן/.test(msg)) { onBadToken(); return; }
      setErr(error.code === 'PGRST202' || /admin_game/.test(msg)
        ? 'הפונקציה admin_game אינה קיימת. להריץ את supabase/admin_game.sql ב-Supabase.'
        : (msg || 'שגיאה בטעינה'));
      setStatus('error');
      return;
    }
    setData(d); setStatus('ready');
  }, [token, from, to, onBadToken]);
  useEffect(() => { load(); }, [load]);

  const preset = (n) => { setFrom(addDays(today, -(n - 1))); setTo(today); };
  const activePreset = to === today ? PRESETS.find((n) => from === addDays(today, -(n - 1))) : null;

  const hard = useMemo(() => (data?.items || [])
    .filter((i) => i.seen >= MIN_SEEN)
    .map((i) => ({ ...i, rate: i.miss / i.seen }))
    .sort((a, b) => b.rate - a.rate || b.seen - a.seen)
    .slice(0, 12), [data]);
  const maxScore = Math.max(1, ...[0, 1, 2, 3, 4, 5].map((s) => data?.scores?.[s] || 0));

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

      {status === 'ready' && data && (
        <>
          <div className="ad-stats">
            <div className="ad-stat"><span>שיחקו</span><b>{fmt(data.players, 0)}</b>
              <small>מתוך {fmt(data.visitors, 0)} שפתחו</small></div>
            <div className="ad-stat"><span>סבבים</span><b>{fmt(data.rounds, 0)}</b>
              <small>{fmt(data.daily, 0)} יומי · {fmt(data.free, 0)} חופשי</small></div>
            <div className="ad-stat"><span>ציון ממוצע (יומי)</span><b>{fmt(data.avg_daily)}</b>
              <small>חופשי: {fmt(data.avg_free)} · מתוך 5</small></div>
            <div className="ad-stat"><span>שיתופים</span><b>{fmt(data.shares, 0)}</b>
              <small>{pct(data.share_players, data.players)} מהשחקנים שיתפו</small></div>
          </div>

          <section className="ad-card gm-dist">
            <h3>התפלגות הציונים</h3>
            {[5, 4, 3, 2, 1, 0].map((s) => {
              const n = data.scores?.[s] || 0;
              return (
                <div className="gm-bar" key={s}>
                  <span className="gm-bar-l">{s}/5</span>
                  <span className="gm-bar-t"><i style={{ width: `${(n / maxScore) * 100}%` }} /></span>
                  <span className="gm-bar-n">{n} <small>{pct(n, data.rounds)}</small></span>
                </div>
              );
            })}
          </section>

          <section className="ad-card">
            <h3>איפה טועים</h3>
            {hard.length ? (
              <ol className="gm-hard">
                {hard.map((i) => (
                  <li key={i.key}>
                    <span className="gm-hard-n">{resolve?.(i.key)?.name || i.key}</span>
                    <span className="gm-hard-r">{Math.round(i.rate * 100)}%</span>
                    <small>{i.miss} מתוך {i.seen}</small>
                  </li>
                ))}
              </ol>
            ) : <p className="ad-note">עוד אין מספיק נתונים (פריט נכנס לרשימה אחרי {MIN_SEEN} הופעות).</p>}
            <p className="ad-note">אחוז הפעמים שהפריט לא הונח במקומו, מתוך הסבבים שבהם הופיע. נאסף מ-5.10.2026.</p>
          </section>

          <details className="ad-card ad-table">
            <summary>טבלה לפי יום</summary>
            <table>
              <thead><tr><th>יום</th><th>שחקנים</th><th>סבבים</th><th>ממוצע</th><th>שיתופים</th></tr></thead>
              <tbody>
                {[...(data.days || [])].reverse().filter((d) => d.rounds || d.shares).map((d) => (
                  <tr key={d.day}>
                    <td>{longDate(String(d.day).slice(0, 10))}</td><td>{d.players}</td><td>{d.rounds}</td>
                    <td>{fmt(d.avg)}</td><td>{d.shares}</td>
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
