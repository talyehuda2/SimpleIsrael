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
      <Winners />
      <Players token={token} />
    </main>
  );
}

/* מנצחי החודש - לפרסום בערוץ הוואטסאפ בסוף כל חודש עברי (בהחלטת בעל האתר).
   בראש החודש הטבלה באתר מתאפסת, ולכן 'prev' (supabase/game_board_prev.sql) מחזיר
   את החודש שהסתיים. אותה game_board של טבלת המובילים, בלי טוקן - היא ממילא פומבית.
   "העתקת הודעה" מכינה את הטקסט לערוץ, ובו קישור למשחק עם src=channel. */
const MEDALS = ['🥇', '🥈', '🥉'];
const SITE = 'simpleisrael.co.il';
const monthName = (s) => {
  try {
    return new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long', timeZone: 'UTC' })
      .format(new Date(`${String(s).slice(0, 10)}T12:00:00Z`));
  } catch { return ''; }
};
function channelText(b) {
  const month = monthName(b.since);
  const top = (b.top || []).filter((r) => r.rank <= 3);
  return [
    `🏆 מנצחי חודש ${month} ב"סדר את הציר"`,
    '',
    ...top.map((r) => `${MEDALS[r.rank - 1]} ${r.nickname} - ${r.points} נקודות (${r.days} ימים)`),
    '',
    `כל הכבוד! ${b.players} שחקנים השתתפו החודש.`,
    'הטבלה התאפסה והמרוץ החדש כבר התחיל - אתגר יומי אחד, עד 5 נקודות ביום:',
    `https://${SITE}/game?src=channel`,
  ].join('\n');
}

function Winners() {
  const [range, setRange] = useState('prev');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    setBoard(null); setErr(''); setCopied(false);
    supabase.rpc('game_board', { p_range: range }).then(({ data, error }) => {
      if (!live) return;
      if (error) { setErr(error.message || 'שגיאה בטעינה'); return; }
      // לפני game_board_prev.sql הפונקציה לא מכירה את 'prev' ומחזירה את החודש הנוכחי
      if (range === 'prev' && !data?.until) {
        setErr('צריך להריץ את supabase/game_board_prev.sql ב-Supabase.'); return;
      }
      setBoard(data);
    });
    return () => { live = false; };
  }, [range]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(channelText(board)); setCopied(true); }
    catch { setErr('ההעתקה נחסמה בדפדפן'); }
  };
  const last = board?.until ? addDays(String(board.until).slice(0, 10), -1) : null;

  return (
    <section className="ad-card gm-win">
      <h3>מנצחי החודש{board ? ` - ${monthName(board.since)}` : ''}</h3>
      <div className="ad-presets" role="group" aria-label="חודש">
        <button className={range === 'prev' ? 'on' : ''} onClick={() => setRange('prev')}>החודש הקודם</button>
        <button className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>החודש הנוכחי</button>
      </div>
      {err && <p className="ad-msg ad-err">{err}</p>}
      {!board && !err && <p className="ad-note">טוען…</p>}
      {board && (
        <>
          <p className="ad-note">
            {longDate(String(board.since).slice(0, 10))}{last ? ` עד ${longDate(last)}` : ''} · {board.players} שחקנים
            {range === 'month' ? ' · החודש עוד לא נגמר' : ''}
          </p>
          {board.top?.length ? (
            <ol className="gm-hard gm-win-l">
              {board.top.slice(0, 10).map((r) => (
                <li key={r.nickname}>
                  <span className="gm-hard-n">{MEDALS[r.rank - 1] || `${r.rank}.`} {r.nickname}</span>
                  <span className="gm-win-p">{r.points}</span>
                  <small>{r.days} ימים</small>
                </li>
              ))}
            </ol>
          ) : <p className="ad-note">אין תוצאות בחודש הזה.</p>}
          {range === 'prev' && board.top?.length > 0 && (
            <button type="button" className="gm-copy" onClick={copy}>
              {copied ? '✓ הועתק - להדביק בערוץ' : '📋 העתקת הודעה לערוץ'}
            </button>
          )}
          <p className="ad-note">שוויון בנקודות: מי ששיחק פחות ימים ראשון. שחקן מוסתר לא נספר.
            לתמונת סטטוס: scripts/status/winners.json.</p>
        </>
      )}
    </section>
  );
}

/* שחקנים רשומים (supabase/game_accounts.sql). הסתרה ולא מחיקה: כינוי פוגעני
   יוצא מטבלת המובילים, והשחקן ממשיך לצבור לעצמו. נטען בנפרד מהסטטיסטיקה,
   כי הוא לא תלוי בטווח התאריכים - ושגיאה בו לא מסתירה את השאר. */
function Players({ token }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_game_players', { p_token: token });
    if (error) {
      setErr(error.code === 'PGRST202' || /admin_game_players/.test(error.message || '')
        ? 'הפונקציה admin_game_players אינה קיימת. להריץ את supabase/game_accounts.sql ב-Supabase.'
        : (error.message || 'שגיאה בטעינה'));
      return;
    }
    setRows(data || []); setErr('');
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (r) => {
    const { error } = await supabase.rpc('admin_game_hide', { p_token: token, p_user: r.user_id, p_hidden: !r.hidden });
    if (error) { setErr(error.message || 'שגיאה'); return; }
    load();
  };

  return (
    <section className="ad-card ad-table">
      <h3>שחקנים רשומים{rows ? ` (${rows.length})` : ''}</h3>
      {err && <p className="ad-msg ad-err">{err}</p>}
      {rows && !rows.length && <p className="ad-note">עוד אין שחקנים רשומים.</p>}
      {rows?.length > 0 && (
        <table>
          <thead><tr><th>כינוי</th><th>מייל</th><th>נקודות</th><th>ימים</th><th>אחרון</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} style={r.hidden ? { opacity: 0.5 } : undefined}>
                <td>{r.nickname}</td>
                <td dir="ltr">{r.email}</td>
                <td>{r.points}</td><td>{r.days}</td>
                <td>{r.last_day ? longDate(String(r.last_day).slice(0, 10)) : '-'}</td>
                <td><button type="button" onClick={() => toggle(r)}>{r.hidden ? 'החזרה לטבלה' : 'הסתרה'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="ad-note">מוסתר = לא מופיע בטבלת המובילים. הנקודות שלו נשמרות.</p>
    </section>
  );
}
