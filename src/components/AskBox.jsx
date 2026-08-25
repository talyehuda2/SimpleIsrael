import { useEffect, useRef, useState } from 'react';
import { getAdminToken } from '../lib/admin.js';

/* תיבת השאלות של הסוכן - כרגע למנהל בלבד, לבדיקת איכות התשובות לפני
   פתיחה לציבור. המפתח לא נמצא כאן: הדפדפן פונה ל-/api/ask, והפונקציה
   בשרת היא זו שמחזיקה אותו. */
const MAX = 500;

// תמחור Opus 5, כדי לראות בזמן אמת מה כל שאלה עולה
const PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };
const costOf = (u) => (
  (u.input * PRICE.input + u.output * PRICE.output
    + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1e6
);

/* המודל מסמן ישויות כ-[[prophet:eliyahu|אליהו]]. כאן זה הופך לקישור
   לחיץ - מה שמחזיר את הקורא אל האתר עצמו במקום להשאיר אותו בטקסט. */
function renderAnswer(text, onJump) {
  const parts = [];
  const re = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, key, label] = m;
    parts.push(
      <button key={`${key}-${m.index}`} className="ask-ref" onClick={() => onJump(key)}>
        {label}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function AskBox({ open, onClose, onJump }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (inputRef.current) inputRef.current.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setErr(''); setResult(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ question }),
      });
      // שגיאת פלטפורמה (404/500 מ-Vercel) מוחזרת כ-HTML ולא כ-JSON,
      // ואז res.json() זורק - בלי זה כל תקלה נראית כמו "אין רשת"
      const data = await res.json().catch(() => null);
      if (!res.ok) setErr(data?.error || `שגיאה ${res.status}`);
      else if (!data) setErr('התקבלה תשובה לא תקינה מהשרת');
      else setResult(data);
    } catch {
      setErr('לא הצלחתי להגיע לשרת');
    }
    setBusy(false);
  };

  return (
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-card ask-card" onClick={(e) => e.stopPropagation()}>
        <button className="about-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h3 className="notes-title">🔎 שאלו על האתר</h3>
        <p className="notes-sub">
          הסוכן עונה רק על סמך הנתונים שבאתר. <b>מצב בדיקה - גלוי למנהל בלבד.</b>
        </p>

        <form onSubmit={submit}>
          <textarea
            ref={inputRef} className="notes-body" rows={2} maxLength={MAX}
            placeholder="למשל: מי היה מלך ישראל בזמן שאליהו ניבא?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
          />
          <div className="notes-actions">
            <span className="comment-count">{q.length}/{MAX}</span>
            <button className="notes-submit" type="submit" disabled={busy || !q.trim()}>
              {busy ? 'חושב…' : 'שאלו'}
            </button>
          </div>
        </form>

        {err && <div className="comment-err">{err}</div>}

        {result && (
          <div className="ask-result">
            <p className="ask-answer">{renderAnswer(result.answer, onJump)}</p>
            {result.truncated && <p className="ask-warn">התשובה נקטעה בתקרת האורך.</p>}
            <div className="ask-meta">
              <span>עלות: <b>{(costOf(result.usage) * 100).toFixed(2)}¢</b></span>
              <span>קלט {result.usage.input} · פלט {result.usage.output}</span>
              <span>מטמון: קרא {result.usage.cacheRead} · כתב {result.usage.cacheWrite}</span>
              {result.fetched.length > 0 && <span>שלף: {result.fetched.join(', ')}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
