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

/* שאלות פתיחה - כל אחת מדגימה יכולת אחרת: הצלבה בין שני נתיבים, מקום,
   כלי בני-הזמן, וחישוב על פני כמה רשומות. הן גם רשימת הזריעה הטבעית
   למטמון התשובות כשזה ייפתח לציבור. */
const SUGGESTIONS = [
  'מי מלך ביהודה כשאליהו ניבא?',
  'מה קרה בשילה?',
  'מי היו בני הזמן של ישעיהו?',
  'כמה שנים עברו מיציאת מצרים ועד בניין המקדש?',
];

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
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [showMeta, setShowMeta] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    if (inputRef.current) inputRef.current.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // שדה שגדל עם הטקסט, במקום תיבה ריקה גדולה שממתינה
  const grow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };
  useEffect(() => { grow(inputRef.current); }, [q, open]);

  if (!open) return null;

  const ask = async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true); setErr(''); setResult(null); setAsked(text); setShowMeta(false);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ question: text }),
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

  const pickSuggestion = (s) => { setQ(s); ask(s); };

  return (
    <div className="ask-overlay" onClick={onClose}>
      <div className="ask-panel" onClick={(e) => e.stopPropagation()}>
        <header className="ask-head">
          <div>
            <h3 className="ask-title">שאלו על האתר</h3>
            <p className="ask-sub">
              עונה על סמך הנתונים שבאתר בלבד
              <span className="ask-badge">בדיקה · מנהל בלבד</span>
            </p>
          </div>
          <button className="ask-x" onClick={onClose} aria-label="סגירה">✕</button>
        </header>

        <form
          className={`ask-row${busy ? ' busy' : ''}`}
          onSubmit={(e) => { e.preventDefault(); ask(q); }}
        >
          <span className="ask-icon" aria-hidden="true">🔎</span>
          <textarea
            ref={inputRef} className="ask-input" rows={1} maxLength={MAX}
            placeholder="מה תרצו לדעת?"
            value={q}
            disabled={busy}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); }
            }}
          />
          <button className="ask-go" type="submit" disabled={busy || !q.trim()} aria-label="שליחה">
            {busy ? <span className="ask-spin" aria-hidden="true" /> : '←'}
          </button>
        </form>
        {q.length > MAX - 100 && <div className="ask-count">{q.length}/{MAX}</div>}

        {/* מצב פתיחה: השאלות מראות מה אפשר לשאול, במקום שדה ריק ושתיקה */}
        {!busy && !result && !err && (
          <div className="ask-suggest">
            <span className="ask-suggest-label">לדוגמה</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="ask-chip" onClick={() => pickSuggestion(s)}>{s}</button>
            ))}
          </div>
        )}

        {busy && (
          <div className="ask-thinking" role="status">
            <span className="ask-dot" /><span className="ask-dot" /><span className="ask-dot" />
            <span className="ask-thinking-text">מחפש בנתוני האתר…</span>
          </div>
        )}

        {err && <div className="ask-err">{err}</div>}

        {result && (
          <div className="ask-result">
            <p className="ask-asked">{asked}</p>
            <div className="ask-answer">{renderAnswer(result.answer, onJump)}</div>
            {result.truncated && <p className="ask-warn">התשובה נקטעה בתקרת האורך.</p>}

            <div className="ask-foot">
              <button className="ask-meta-toggle" onClick={() => setShowMeta((v) => !v)}>
                <b>{(costOf(result.usage) * 100).toFixed(2)}¢</b>
                <span className="ask-meta-caret">{showMeta ? '▾' : '▸'}</span>
              </button>
              {result.fetched.length > 0 && (
                <span className="ask-fetched">{result.fetched.length} רשומות נשלפו</span>
              )}
            </div>
            {showMeta && (
              <dl className="ask-meta">
                <div><dt>קלט</dt><dd>{result.usage.input.toLocaleString()}</dd></div>
                <div><dt>פלט</dt><dd>{result.usage.output.toLocaleString()}</dd></div>
                <div><dt>מטמון · קרא</dt><dd>{result.usage.cacheRead.toLocaleString()}</dd></div>
                <div>
                  <dt>מטמון · כתב</dt>
                  <dd>{result.usage.cacheWrite.toLocaleString()}
                    {result.usage.cacheWrite === 0 && <span className="ask-ok"> חם</span>}
                  </dd>
                </div>
                {result.fetched.length > 0 && (
                  <div className="ask-meta-wide"><dt>נשלף</dt><dd>{result.fetched.join(' · ')}</dd></div>
                )}
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
