import { useEffect, useRef, useState } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseConfig.js';

// תיבת פניות למנהל - פרטית. ההערות נשמרות עם target_key='admin:notes',
// שכלל ה-RLS מסתיר מקריאה ציבורית. שליחה ב-fetch ישיר (בלי supabase-js)
// כדי לא להכביד על החבילה הראשית. ההתראות (מייל/טלגרם) נשלחות ע"י אותו טריגר.
const MAX = 1000;

async function postNote(row) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function NotesBox({ open, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const hp = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setDone(false); setErr('');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true); setErr('');
    /* המייל והטלפון נשלחים רק אם מולאו. השדה נוסף לטבלה בנפרד, ושליחת
       contact: null בכל הערה הייתה מפילה כל פנייה עד שהעמודה קיימת. */
    const contact = [email.trim(), phone.trim()].filter(Boolean).join(' · ');
    const ok = await postNote({
      target_key: 'admin:notes',
      target_label: '📋 הערה כללית למנהל',
      author: name.trim().slice(0, 40) || null,
      body: text.slice(0, MAX),
      hp: hp.current ? hp.current.value : '',
      ...(contact ? { contact } : {}),
    });
    setSending(false);
    if (!ok) { setErr('השליחה נכשלה - נסו שוב'); return; }
    setName(''); setEmail(''); setPhone(''); setBody(''); setDone(true);
  };

  return (
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-card" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="סגירה">✕</button>
        {done ? (
          <div className="notes-done">
            <div className="notes-done-icon" aria-hidden="true">✓</div>
            <h3>ההערה נשלחה - תודה!</h3>
            <p>הפנייה הגיעה ישירות למנהל האתר. תודה שעזרתם לשפר.</p>
            <button className="notes-submit" onClick={onClose}>סגירה</button>
          </div>
        ) : (
          <>
            <h3 className="notes-title">✍️ הערה למנהל האתר</h3>
            <p className="notes-sub">הערות, הארות, תיקונים או כל דבר אחר - יגיעו ישירות למנהל ולא יוצגו באתר.</p>
            <form onSubmit={submit}>
              <input
                className="notes-name" type="text" name="name" autoComplete="name"
                placeholder="שם (אופציונלי)"
                value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
              />
              {/* type ו-autoComplete הם מה שגורם לדפדפן להציע השלמה. בלעדיהם
                  זה סתם עוד שדה טקסט, והמבקר מקליד את המייל שלו מחדש. */}
              <input
                className="notes-field" type="email" name="email" autoComplete="email"
                inputMode="email" placeholder="מייל - אם תרצו שאחזור אליכם"
                value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="notes-field" type="tel" name="tel" autoComplete="tel"
                inputMode="tel" placeholder="טלפון (לא חובה)"
                value={phone} maxLength={30} onChange={(e) => setPhone(e.target.value)}
              />
              <p className="notes-hint">פרטי הקשר לא יוצגו באתר ולא יישלחו לאף אחד - הם רק כדי שאוכל לחזור אליכם.</p>
              <input ref={hp} className="comment-hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <textarea
                className="notes-body" placeholder="כתבו כאן…" rows={5}
                value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)}
              />
              <div className="notes-actions">
                <span className="comment-count">{body.length}/{MAX}</span>
                <button className="notes-submit" type="submit" disabled={sending || !body.trim()}>
                  {sending ? 'שולח…' : 'שליחה'}
                </button>
              </div>
              {err && <div className="comment-err">{err}</div>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
