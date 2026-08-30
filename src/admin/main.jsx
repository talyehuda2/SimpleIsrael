/* מסך הניהול - נבנה כדי לענות מהטלפון.
 *
 * עד היום פנייה פרטית ("הערה למנהל") נשמרה עם target_key='admin:notes',
 * הטריגר שלח עליה מייל, ושם זה נגמר: אין ממשק שקורא אותן, אין דרך לסמן
 * שטופלו, ומחיקת תגובה דורשת דפדפן שבו כבר הוקלד טוקן הניהול. כלומר כל
 * מענה למשתמש חייב מחשב.
 *
 * המסך הזה הוא נקודת כניסה רביעית, עצמאית לגמרי: גיליון סגנונות משלו
 * (admin.css), בלי שום הסתמכות על styles.css או על מסך אחר - בדיוק המלכודת
 * שה-CLAUDE.md מזהיר ממנה. הקריאה נעשית ב-RPC אחד (admin_inbox) שמוודא
 * טוקן בצד המסד, ולכן אין כאן מפתח סודי ואין פונקציה בצד שרת.
 */
import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '../lib/supabase.js';
import { getAdminToken, setAdminToken } from '../lib/admin.js';
import './admin.css';

const NOTES = 'admin:notes';

function fmt(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `לפני ${Math.max(1, mins)} דק׳`;
  if (mins < 60 * 24) return `לפני ${Math.round(mins / 60)} שע׳`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// אותה לוגיקה של המייל שהטריגר שולח, כדי ששתי הדרכים יובילו לאותו מקום
function siteUrl(key) {
  return key.startsWith('place:')
    ? `/places?p=${encodeURIComponent(key.slice(6))}`
    : `/?sel=${encodeURIComponent(key)}`;
}

// contact נשמר כ-"מייל · טלפון" ולכן שני השדות נשלפים ממנו בנפרד
const emailOf = (c) => (c || '').match(/[^\s·,;]+@[^\s·,;]+\.[^\s·,;]+/)?.[0] || '';
const phoneOf = (c) => (c || '').split('·').map((s) => s.trim())
  .find((s) => /^[+\d][\d\-() ]{6,}$/.test(s)) || '';

function mailtoFor(row) {
  const quoted = String(row.body).split('\n').map((l) => `> ${l}`).join('\n');
  const when = new Date(row.created_at).toLocaleDateString('he-IL');
  const body = `${row.author ? `${row.author}, ` : ''}שלום,\n\n\n\n---\nבתאריך ${when} כתבת לנו:\n${quoted}\n`;
  return `mailto:${emailOf(row.contact)}`
    + `?subject=${encodeURIComponent('תשובה לפנייה שלך · ציר הזמן של עם ישראל')}`
    + `&body=${encodeURIComponent(body)}`;
}

/* ---------- מסך הטוקן ---------- */
function Login({ onToken }) {
  const [val, setVal] = useState('');
  return (
    <form className="ad-login" onSubmit={(e) => { e.preventDefault(); if (val.trim()) onToken(val.trim()); }}>
      <h1>ניהול</h1>
      <p>הדביקו את טוקן הניהול. הוא נשמר בדפדפן הזה בלבד.</p>
      {/* type=password כדי שהטוקן לא יישאר גלוי על מסך פתוח */}
      <input
        type="password" autoComplete="off" value={val} placeholder="טוקן ניהול"
        onChange={(e) => setVal(e.target.value)} aria-label="טוקן ניהול"
      />
      <button type="submit" disabled={!val.trim()}>כניסה</button>
    </form>
  );
}

/* ---------- תיבת תשובה לתגובה ציבורית ---------- */
function ReplyForm({ row, onSent }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true); setErr('');
    // הוספה רגילה בדיוק כמו של גולש: הטריגר notify_comment_reply מזהה
    // parent_id ושולח מייל למגיב, בלי שנצטרך לגעת בו
    const { error } = await supabase.from('comments').insert({
      target_key: row.target_key,
      target_label: row.target_label,
      parent_id: row.id,
      author: 'מנהל האתר',
      body,
    });
    setBusy(false);
    if (error) { setErr('השליחה נכשלה'); return; }
    setText(''); onSent();
  };

  return (
    <form className="ad-reply" onSubmit={send}>
      <textarea
        rows={3} maxLength={1000} value={text} placeholder="תשובה כמנהל האתר…"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="ad-reply-foot">
        {row.will_email && <span className="ad-hint">✉️ המגיב יקבל מייל</span>}
        {err && <span className="ad-err">{err}</span>}
        <button type="submit" disabled={busy || !text.trim()}>{busy ? 'שולח…' : 'שליחה'}</button>
      </div>
    </form>
  );
}

/* ---------- המסך ---------- */
function Admin() {
  const [token, setToken] = useState(getAdminToken());
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('notes');
  const [showHandled, setShowHandled] = useState(false);
  const [openReply, setOpenReply] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus('loading'); setErr('');
    const { data, error } = await supabase.rpc('admin_inbox', { p_token: token });
    if (error) {
      setStatus('error');
      // הבחנה בין "הטוקן שגוי" לבין "ה-SQL לא רץ" - שתי תקלות שונות לגמרי
      const msg = error.message || '';
      if (/טוקן/.test(msg)) { setAdminToken(''); setToken(''); return; }
      setErr(error.code === 'PGRST202' || /admin_inbox/.test(msg)
        ? 'הפונקציה admin_inbox אינה קיימת. להריץ את supabase/admin_inbox.sql ב-Supabase.'
        : (msg || 'שגיאה בטעינה'));
      return;
    }
    setRows(data || []);
    setStatus('ready');
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveToken = (t) => { setAdminToken(t); setToken(t); };
  const logout = () => { setAdminToken(''); setToken(''); setRows([]); };

  const remove = async (id) => {
    if (!window.confirm('למחוק? (תשובות בשרשור יימחקו גם הן)')) return;
    setBusyId(id);
    const { error } = await supabase.rpc('admin_delete_comment', { p_id: id, p_token: token });
    setBusyId(null);
    if (error) { window.alert('המחיקה נכשלה'); return; }
    setRows((l) => l.filter((r) => r.id !== id && r.parent_id !== id));
  };

  const setHandled = async (id, handled) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_mark_handled', { p_id: id, p_token: token, p_handled: handled });
    setBusyId(null);
    if (error) { window.alert('העדכון נכשל'); return; }
    setRows((l) => l.map((r) => (
      r.id === id ? { ...r, handled_at: handled ? new Date().toISOString() : null } : r
    )));
  };

  if (!token) return <Login onToken={saveToken} />;

  const notes = rows.filter((r) => r.target_key === NOTES && !r.parent_id);
  const openNotes = notes.filter((r) => !r.handled_at);
  const shownNotes = showHandled ? notes : openNotes;
  const roots = rows.filter((r) => r.target_key !== NOTES && !r.parent_id);
  const repliesOf = (id) => rows.filter((r) => r.parent_id === id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="ad">
      <header className="ad-bar">
        <h1>ניהול</h1>
        <div className="ad-bar-tools">
          <button onClick={load} title="רענון" aria-label="רענון">↻</button>
          <button onClick={logout}>יציאה</button>
        </div>
      </header>

      <nav className="ad-tabs">
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          פניות {openNotes.length > 0 && <span className="ad-badge">{openNotes.length}</span>}
        </button>
        <button className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>
          תגובות {roots.length > 0 && <span className="ad-count">{roots.length}</span>}
        </button>
      </nav>

      {status === 'loading' && <p className="ad-msg">טוען…</p>}
      {status === 'error' && <p className="ad-msg ad-err">{err}</p>}

      {status === 'ready' && tab === 'notes' && (
        <main className="ad-list">
          <label className="ad-toggle">
            <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />
            הצגת פניות שטופלו
          </label>
          {shownNotes.length === 0 && <p className="ad-msg">אין פניות ממתינות.</p>}
          {shownNotes.map((r) => (
            <article key={r.id} className={`ad-card${r.handled_at ? ' done' : ''}`}>
              <div className="ad-head">
                <b>{r.author || 'אנונימי'}</b>
                <time>{fmt(r.created_at)}</time>
              </div>
              {r.contact && (
                <div className="ad-contact">
                  {emailOf(r.contact) && <a href={`mailto:${emailOf(r.contact)}`}>{emailOf(r.contact)}</a>}
                  {phoneOf(r.contact) && (
                    <a href={`tel:${phoneOf(r.contact).replace(/[^+\d]/g, '')}`}>{phoneOf(r.contact)}</a>
                  )}
                </div>
              )}
              <p className="ad-body">{r.body}</p>
              <div className="ad-tools">
                {/* מענה במייל ולא בתוך האתר: פנייה פרטית אינה שרשור, והאדם
                    השאיר כתובת כדי שיחזרו אליו. mailto פותח את אפליקציית
                    המייל של הטלפון עם הציטוט כבר בפנים. */}
                {emailOf(r.contact) && <a className="ad-btn primary" href={mailtoFor(r)}>✉️ מענה במייל</a>}
                <button className="ad-btn" disabled={busyId === r.id} onClick={() => setHandled(r.id, !r.handled_at)}>
                  {r.handled_at ? '↩︎ החזרה לטיפול' : '✓ טופל'}
                </button>
                <button className="ad-btn danger" disabled={busyId === r.id} onClick={() => remove(r.id)}>🗑</button>
              </div>
            </article>
          ))}
        </main>
      )}

      {status === 'ready' && tab === 'comments' && (
        <main className="ad-list">
          {roots.length === 0 && <p className="ad-msg">אין תגובות.</p>}
          {roots.map((r) => (
            <article key={r.id} className="ad-card">
              <div className="ad-head">
                <b>{r.author || 'אנונימי'}</b>
                <time>{fmt(r.created_at)}</time>
              </div>
              <a className="ad-target" href={siteUrl(r.target_key)} target="_blank" rel="noreferrer">
                {r.target_label || r.target_key} ↗
              </a>
              <p className="ad-body">{r.body}</p>
              {repliesOf(r.id).map((c) => (
                <div key={c.id} className="ad-sub">
                  <div className="ad-head">
                    <b>{c.author || 'אנונימי'}</b>
                    <time>{fmt(c.created_at)}</time>
                  </div>
                  <p className="ad-body">{c.body}</p>
                  <button className="ad-btn danger small" disabled={busyId === c.id} onClick={() => remove(c.id)}>🗑</button>
                </div>
              ))}
              <div className="ad-tools">
                <button className="ad-btn primary" onClick={() => setOpenReply(openReply === r.id ? null : r.id)}>
                  {openReply === r.id ? 'ביטול' : '↩︎ תשובה'}
                </button>
                <button className="ad-btn danger" disabled={busyId === r.id} onClick={() => remove(r.id)}>🗑</button>
              </div>
              {openReply === r.id && <ReplyForm row={r} onSent={() => { setOpenReply(null); load(); }} />}
            </article>
          ))}
        </main>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
