import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAdminToken } from '../lib/admin.js';

const MAX_LEN = 1000;
const MAX_NAME = 40;

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// טופס כתיבה - משמש גם לתגובה חדשה וגם לתשובה בתוך שרשור
function CommentForm({ targetKey, targetLabel, parentId = null, compact = false, onDone, onCancel }) {
  const [author, setAuthor] = useState('');
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const hp = useRef(null); // honeypot

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX_LEN) { setErr(`מקסימום ${MAX_LEN} תווים`); return; }
    setSending(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({
        target_key: targetKey,
        target_label: targetLabel || null,
        parent_id: parentId,
        author: author.trim().slice(0, MAX_NAME) || null,
        body: text,
        // נשלח רק אם מולא. העמודה חסומה לקריאה מהדפדפן ברמת בסיס
        // הנתונים, ולכן כתובת של מגיב אחד אינה נחשפת למגיב הבא.
        notify_email: email.trim() || null,
        hp: hp.current ? hp.current.value : '',
      })
      .select('id, created_at, author, body, parent_id')
      .single();
    setSending(false);
    if (error) { setErr('שליחת התגובה נכשלה, נסו שוב'); return; }
    setBody(''); setAuthor(''); setEmail('');
    onDone(data);
  };

  return (
    <form className={`comment-form${compact ? ' compact' : ''}`} onSubmit={submit}>
      <div className="comment-ids">
        <input
          className="comment-name" type="text" placeholder="שם (אופציונלי)" aria-label="שם (לא חובה)"
          name="name" autoComplete="name"
          value={author} maxLength={MAX_NAME} onChange={(e) => setAuthor(e.target.value)}
        />
        {/* type ו-autoComplete תקניים כדי שהדפדפן ישלים לבד. הכתובת
            אינה מוצגת לאיש ומשמשת רק להודעה על תשובה לתגובה הזו. */}
        <input
          className="comment-mail" type="email" inputMode="email"
          name="email" autoComplete="email"
          placeholder="מייל לעדכון אם יגיבו לך (לא יוצג)"
          aria-label="כתובת מייל לעדכון אם יגיבו לך. לא מוצגת באתר"
          value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {/* honeypot - נסתר מבני-אדם, בוטים ממלאים אותו */}
      <input ref={hp} className="comment-hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <textarea
        className="comment-body"
        placeholder={parentId ? 'תשובה…' : 'הוסיפו הערה, מקור או תיקון…'}
        aria-label={parentId ? 'תשובה לתגובה' : 'הערה, מקור או תיקון'}
        value={body} maxLength={MAX_LEN} rows={2}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="comment-actions">
        <span className="comment-count">{body.length}/{MAX_LEN}</span>
        {onCancel && <button type="button" className="comment-cancel" onClick={onCancel}>ביטול</button>}
        <button className="comment-submit" type="submit" disabled={sending || !body.trim()}>
          {sending ? 'שולח…' : parentId ? 'שליחת תשובה' : 'פרסום'}
        </button>
      </div>
      {err && <div className="comment-err">{err}</div>}
    </form>
  );
}

/* ⚠️ הרכיב הזה חייב לשבת כאן, ברמת המודול, ולא בתוך Comments.

   רכיב שמוגדר בתוך רכיב אחר מקבל זהות חדשה בכל רינדור של האב, ולכן
   React אינו מזהה אותו כאותו רכיב - הוא הורס את כל תת-העץ ובונה מחדש.
   כשמצב טופס הדיווח ישב באב, כל תו שהוקלד גרם לרינדור, וההרס הזה מחק
   את השדה שהמשתמש הקליד בו ואיבד את הפוקוס אחרי כל אות.

   הבאג היה קיים גם קודם, אבל היה בלתי נראה: replyTo משתנה בלחיצה אחת,
   ורינדור בודד אינו מורגש. שדה טקסט חשף אותו.

   כל התלויות עוברות כ-props במפורש. זה ארוך יותר, וזה בדיוק מה שמונע
   את החזרה. */
function Comment({
  c, isReply = false,
  replyTo, setReplyTo,
  reported, reportId, setReportId, reportWhy, setReportWhy, reportBusy, sendReport,
  adminToken, busyId, remove,
}) {
  return (
      <div className={`comment${isReply ? ' reply' : ''}`}>
        <div className="comment-head">
          <span className="comment-author">{c.author || 'אנונימי'}</span>
          <span className="comment-date">{fmtDate(c.created_at)}</span>
        </div>
        <div className="comment-text">{c.body}</div>
        <div className="comment-tools">
          {!isReply && (
            <button type="button" className="comment-link" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              {replyTo === c.id ? 'ביטול' : 'השב'}
            </button>
          )}
          {reported.includes(c.id) ? (
            <span className="comment-reported">✓ הדיווח נשלח</span>
          ) : (
            <button
              type="button" className="comment-link"
              onClick={() => { setReportId(reportId === c.id ? null : c.id); setReportWhy(''); }}
            >
              {reportId === c.id ? 'ביטול' : '⚑ דיווח'}
            </button>
          )}
          {adminToken && (
            <button
              type="button" className="comment-link danger"
              disabled={busyId === c.id} onClick={() => remove(c.id)}
            >
              {busyId === c.id ? 'מוחק…' : '🗑 מחיקה'}
            </button>
          )}
        </div>

        {reportId === c.id && (
          <div className="comment-report">
            <p className="comment-report-lead">
              מה הבעיה בתגובה הזו? התיאור עוזר לי לטפל מהר, ואפשר גם לשלוח בלעדיו.
            </p>
            <input
              className="comment-report-why" type="text" maxLength={300}
              placeholder="למשל: פוגעני, לשון הרע, ספאם, פרטים אישיים"
              aria-label="סיבת הדיווח (לא חובה)"
              value={reportWhy} onChange={(e) => setReportWhy(e.target.value)}
            />
            <button
              type="button" className="comment-report-send"
              disabled={reportBusy} onClick={() => sendReport(c)}
            >
              {reportBusy ? 'שולח…' : 'שליחת הדיווח'}
            </button>
          </div>
        )}
      </div>
  );
}

export default function Comments({ targetKey, targetLabel }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [replyTo, setReplyTo] = useState(null);
  const [busyId, setBusyId] = useState(null);
  /* דיווח: המצב חייב לשבת כאן ולא ב-Comment, שנוצר מחדש בכל רינדור
     ולכן היה מאבד כל תו שמקלידים בשדה הסיבה. */
  const [reportId, setReportId] = useState(null);
  const [reportWhy, setReportWhy] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reported, setReported] = useState([]);
  const adminToken = getAdminToken();

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    supabase
      .from('comments')
      .select('id, created_at, author, body, parent_id')
      .eq('target_key', targetKey)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setStatus('error'); return; }
        setList(data || []);
        setStatus('ready');
      });
    return () => { alive = false; };
  }, [targetKey]);

  /* הדיווח נשלח כפנייה רגילה למנהל, ולכן הוא נוחת בתיבה הקיימת ב-/admin
     ומקבל שם מחיקה וסימון "טופל" בלי שום צנרת חדשה. הוא גם עובר דרך
     הסיווג האוטומטי, ש-target_label ונוסח הגוף מכוונים אותו לקטגוריית
     "הסרה" - זו שמתחילה את שעון ארבעה-עשר הימים לפי /terms. */
  const sendReport = async (c) => {
    setReportBusy(true);
    const why = reportWhy.trim().slice(0, 300);
    const { error } = await supabase.from('comments').insert({
      target_key: 'admin:notes',
      target_label: '🚩 דיווח על תגובה',
      author: null,
      body: [
        `דיווח על תגובה מספר ${c.id}, בעמוד "${targetLabel || targetKey}".`,
        `נכתבה בידי: ${c.author || 'אנונימי'}`,
        '',
        'תוכן התגובה:',
        `"${String(c.body || '').slice(0, 600)}"`,
        '',
        `סיבת הדיווח: ${why || 'לא נמסרה'}`,
      ].join('\n'),
      hp: '',
    });
    setReportBusy(false);
    if (error) { window.alert('הדיווח לא נשלח - נסו שוב'); return; }
    setReported((r) => [...r, c.id]);
    setReportId(null); setReportWhy('');
  };

  const remove = async (id) => {
    if (!adminToken) return;
    if (!window.confirm('למחוק את התגובה? (תשובות בשרשור יימחקו גם הן)')) return;
    setBusyId(id);
    const { error } = await supabase.rpc('admin_delete_comment', { p_id: id, p_token: adminToken });
    setBusyId(null);
    if (error) { window.alert('המחיקה נכשלה - ייתכן שטוקן הניהול שגוי.'); return; }
    // מסירים גם את התשובות שהיו תלויות בתגובה שנמחקה
    setList((l) => l.filter((c) => c.id !== id && c.parent_id !== id));
  };

  const roots = list.filter((c) => !c.parent_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const repliesOf = (id) => list.filter((c) => c.parent_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));


  return (
    <section className="comments">
      <h3 className="comments-title">
        תגובות{status === 'ready' && list.length > 0 ? ` (${list.length})` : ''}
      </h3>

      <CommentForm
        targetKey={targetKey} targetLabel={targetLabel}
        onDone={(row) => setList((l) => [...l, row])}
      />

      {status === 'loading' && <div className="comments-empty">טוען תגובות…</div>}
      {status === 'error' && <div className="comments-empty">שגיאה בטעינת התגובות</div>}
      {status === 'ready' && list.length === 0 && (
        <div className="comments-empty">אין עדיין תגובות - היו הראשונים להוסיף!</div>
      )}

      <ul className="comment-list">
        {roots.map((c) => (
          <li key={c.id} className="comment-thread">
            <Comment
              c={c}
              replyTo={replyTo} setReplyTo={setReplyTo}
              reported={reported} reportId={reportId} setReportId={setReportId}
              reportWhy={reportWhy} setReportWhy={setReportWhy}
              reportBusy={reportBusy} sendReport={sendReport}
              adminToken={adminToken} busyId={busyId} remove={remove}
            />
            {repliesOf(c.id).map((r) => <Comment
              key={r.id} c={r} isReply
              replyTo={replyTo} setReplyTo={setReplyTo}
              reported={reported} reportId={reportId} setReportId={setReportId}
              reportWhy={reportWhy} setReportWhy={setReportWhy}
              reportBusy={reportBusy} sendReport={sendReport}
              adminToken={adminToken} busyId={busyId} remove={remove}
            />)}
            {replyTo === c.id && (
              <div className="reply-box">
                <CommentForm
                  targetKey={targetKey} targetLabel={targetLabel} parentId={c.id} compact
                  onCancel={() => setReplyTo(null)}
                  onDone={(row) => { setList((l) => [...l, row]); setReplyTo(null); }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
