import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAdminToken } from '../lib/admin.js';
// הסגנון בבעלות הרכיב ולא ב-styles.css - המלכודת מספר אחת ב-CLAUDE.md
import './Comments.css';

const MAX_LEN = 1000;
const MAX_NAME = 40;
// המונה מופיע רק כשמתקרבים לגבול. 0/1000 קבוע מתחת לכל טופס היה רעש
const COUNT_FROM = MAX_LEN - 200;
// השם נשמר במכשיר כדי שלא יוקלד מחדש בכל תגובה. המייל לא: זה מידע אישי,
// ומי שמגיב ממחשב משותף לא היה מצפה שיופיע לבא אחריו.
const NAME_KEY = 'si_cname';
// שמות ששמורים למנהל האתר. גם השרת חוסם אותם (supabase/admin_badge.sql); כאן
// זה רק כדי לתת הסבר לפני שליחה ולא "השליחה נכשלה"
const RESERVED = /(מנהל|אדמין|admin|simpleisrael)/i;
const loadName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = (v) => {
  try { if (v) localStorage.setItem(NAME_KEY, v); else localStorage.removeItem(NAME_KEY); } catch { /* מצב פרטי */ }
};

function fullDate(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/* "לפני 3 שעות" במקום "5 באוקטובר 2026". מעבר לשבוע - תאריך, והשנה רק
   כשהיא לא השנה הנוכחית. התאריך המלא נשאר ב-title. */
function relTime(iso) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return min === 1 ? 'לפני דקה' : `לפני ${min} דקות`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  const days = Math.round(h / 24);
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  if (days < 7) return `לפני ${days} ימים`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/* עיגול עם האות הראשונה. הצבע נגזר מהשם, כך שאותו מגיב מקבל אותו צבע
   בכל השרשור. כולם כהים מספיק לאות לבנה (מעל 6:1). */
const AV_COLORS = ['#163a57', '#7a5b16', '#2f6b34', '#8b2f3c', '#4f4380', '#7a3f1d'];
function Avatar({ name, small, admin }) {
  if (admin) {
    return <span className={`comment-av admin${small ? ' small' : ''}`} aria-hidden="true">📜</span>;
  }
  const n = (name || '').trim();
  let h = 0;
  for (const ch of n) h = (h * 31 + ch.codePointAt(0)) % 997;
  return (
    <span
      className={`comment-av${small ? ' small' : ''}${n ? '' : ' anon'}`}
      style={n ? { background: AV_COLORS[h % AV_COLORS.length] } : undefined}
      aria-hidden="true"
    >{n ? [...n][0] : '?'}</span>
  );
}

/* קישורים לחיצים - אנשים מביאים מקורות. nofollow ו-ugc אומרים לגוגל שזה
   תוכן גולשים, וכך לספאמר אין מה להרוויח מקישור כאן. פיסוק בסוף הכתובת
   (נקודה, סוגריים, מירכאות) אינו חלק ממנה. */
const URL_RE = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g;
function Linked({ text }) {
  return String(text).split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const m = part.match(/^(.*?)([.,;:!?)\]'"״׳]*)$/);
    const url = m[1];
    const shown = url.replace(/^https?:\/\//, '');
    return (
      <span key={i}>
        <a
          href={url.startsWith('www.') ? `https://${url}` : url}
          target="_blank" rel="nofollow ugc noopener noreferrer" dir="ltr"
        >{shown.length > 42 ? `${shown.slice(0, 40)}…` : shown}</a>{m[2]}
      </span>
    );
  });
}

/* טופס כתיבה - משמש גם לתגובה חדשה וגם לתשובה בתוך שרשור.
   הטופס הראשי מקופל לשורה אחת עד שנוגעים בו: קודם שלושה שדות וכפתור ישבו
   בין הגולש לתגובות, ובטלפון התגובות התחילו רק בחצי המסך השני. */
function CommentForm({ targetKey, targetLabel, parentId = null, compact = false, adminToken, onDone, onCancel }) {
  const [open, setOpen] = useState(compact);
  const [author, setAuthor] = useState(loadName);
  const [email, setEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [posted, setPosted] = useState(false);
  const hp = useRef(null); // honeypot
  const hintId = useRef(`cmh-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    if (!posted) return undefined;
    const t = setTimeout(() => setPosted(false), 5000);
    return () => clearTimeout(t);
  }, [posted]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX_LEN) { setErr(`מקסימום ${MAX_LEN} תווים`); return; }
    const name = author.trim().slice(0, MAX_NAME);
    if (!adminToken && RESERVED.test(name)) { setErr('השם הזה שמור למנהל האתר. בחרו שם אחר.'); return; }
    setSending(true);
    const insert = (who) => supabase
      .from('comments')
      .insert({
        target_key: targetKey,
        target_label: targetLabel || null,
        parent_id: parentId,
        author: who || null,
        body: text,
        // נשלח רק אם מולא. העמודה חסומה לקריאה מהדפדפן ברמת בסיס
        // הנתונים, ולכן כתובת של מגיב אחד אינה נחשפת למגיב הבא.
        notify_email: email.trim() || null,
        hp: hp.current ? hp.current.value : '',
      })
      .select('id, created_at, author, body, parent_id')
      .single();
    // מנהל (טוקן שמור בדפדפן) כותב דרך הפונקציה שבודקת את הטוקן - רק כך
    // התגובה מקבלת את התג "מהאתר". עד שהורץ admin_badge.sql הפונקציה לא
    // קיימת (PGRST202), ואז הוספה רגילה בשם "מנהל האתר" כמו קודם.
    let res = adminToken
      ? await supabase.rpc('admin_post_comment', {
        p_token: adminToken, p_body: text, p_parent: parentId,
        p_target_key: targetKey, p_target_label: targetLabel || null,
      }).single()
      : await insert(name);
    if (adminToken && res.error?.code === 'PGRST202') res = await insert('מנהל האתר');
    const { data, error } = res;
    setSending(false);
    if (error) {
      setErr(/שמור|דקה|כבר נשלחה/.test(error.message || '') ? error.message : 'שליחת התגובה נכשלה, נסו שוב');
      return;
    }
    if (!adminToken) saveName(name);
    setBody(''); setEmail('');
    if (!compact) { setOpen(false); setPosted(true); }
    onDone(data);
  };

  const cancel = () => {
    if (onCancel) { onCancel(); return; }
    setBody(''); setErr(''); setOpen(false);
  };

  return (
    <form className={`comment-form${compact ? ' compact' : ''}${open ? ' open' : ''}`} onSubmit={submit}>
      <textarea
        className="comment-body"
        placeholder={parentId ? 'תשובה…' : 'הוסיפו הערה, מקור או תיקון…'}
        aria-label={parentId ? 'תשובה לתגובה' : 'הערה, מקור או תיקון'}
        value={body} maxLength={MAX_LEN} rows={open ? 3 : 1}
        autoFocus={compact}
        onFocus={() => { setOpen(true); setPosted(false); }}
        onChange={(e) => setBody(e.target.value)}
      />
      {/* honeypot - נסתר מבני-אדם, בוטים ממלאים אותו */}
      <input ref={hp} className="comment-hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      {open && (
        <>
          {adminToken ? (
            <p className="comment-hint">תפורסם בשם מנהל האתר, עם התג "מהאתר".</p>
          ) : (<>
          <div className="comment-ids">
            <input
              className="comment-name" type="text" placeholder="שם (לא חובה)" aria-label="שם (לא חובה)"
              name="name" autoComplete="name"
              value={author} maxLength={MAX_NAME} onChange={(e) => setAuthor(e.target.value)}
            />
            {/* type ו-autoComplete תקניים כדי שהדפדפן ישלים לבד. ההסבר יושב
                מתחת ולא ב-placeholder: בטלפון ה-placeholder נחתך באמצע
                ו"לא יוצג" - החלק החשוב - נעלם. */}
            <input
              className="comment-mail" type="email" inputMode="email"
              name="email" autoComplete="email"
              placeholder="מייל (לא חובה)" aria-label="מייל (לא חובה)" aria-describedby={hintId}
              value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="comment-hint" id={hintId}>
            המייל לא מוצג באתר - רק לעדכון כשעונים לכם.
          </p>
          </>)}
          <div className="comment-actions">
            {body.length > COUNT_FROM && <span className="comment-count">{body.length}/{MAX_LEN}</span>}
            <button type="button" className="comment-cancel" onClick={cancel}>ביטול</button>
            <button className="comment-submit" type="submit" disabled={sending || !body.trim()}>
              {sending ? 'שולח…' : parentId ? 'שליחת תשובה' : 'פרסום'}
            </button>
          </div>
        </>
      )}
      {err && <div className="comment-err">{err}</div>}
      <div className="comment-posted" role="status">{posted ? '✓ התגובה פורסמה' : ''}</div>
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
  c, isReply = false, isFresh = false,
  replyTo, setReplyTo,
  reported, reportId, setReportId, reportWhy, setReportWhy, reportBusy, sendReport,
  adminToken, busyId, remove,
}) {
  const ref = useRef(null);
  // תגובה שהגולש פרסם זה עתה: גלילה אליה והבהוב קצר, כדי שיראה שהיא שם
  useEffect(() => {
    if (!isFresh || !ref.current) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [isFresh]);

  return (
      <div ref={ref} className={`comment${isReply ? ' reply' : ''}${c.by_admin ? ' by-admin' : ''}${isFresh ? ' fresh' : ''}`}>
        <Avatar name={c.author} small={isReply} admin={c.by_admin} />
        <div className="comment-main">
          <div className="comment-head">
            <span className="comment-author">{c.author || 'אנונימי'}</span>
            {c.by_admin && <span className="comment-badge" title="תגובה של מנהל האתר">✓ מהאתר</span>}
            <time className="comment-date" dateTime={c.created_at} title={fullDate(c.created_at)}>
              {relTime(c.created_at)}
            </time>
          </div>
          <div className="comment-text"><Linked text={c.body} /></div>
          <div className="comment-tools">
            {!isReply && (
              <button
                type="button" className="comment-link"
                aria-expanded={replyTo === c.id}
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              >
                {replyTo === c.id ? 'ביטול' : '↩ השב'}
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
  const [fresh, setFresh] = useState(null);
  const adminToken = getAdminToken();

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    const load = (cols) => supabase
      .from('comments')
      .select(cols)
      .eq('target_key', targetKey)
      .order('created_at', { ascending: true });
    /* by_admin נוספה ב-admin_badge.sql. עד שהקובץ רץ העמודה לא קיימת והשאילתה
       נכשלת, ולכן ניסיון שני בלעדיה - כך האתר לא תלוי בסדר הפריסה וההרצה. */
    load('id, created_at, author, body, parent_id, by_admin')
      .then((r) => (r.error?.code === '42703' ? load('id, created_at, author, body, parent_id') : r))
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
        targetKey={targetKey} targetLabel={targetLabel} adminToken={adminToken}
        onDone={(row) => { setList((l) => [...l, row]); setFresh(row.id); }}
      />

      {status === 'loading' && <div className="comments-empty">טוען תגובות…</div>}
      {status === 'error' && <div className="comments-empty">שגיאה בטעינת התגובות</div>}
      {status === 'ready' && list.length === 0 && (
        <div className="comments-empty">אין עדיין תגובות - היו הראשונים להוסיף!</div>
      )}

      <ul className="comment-list">
        {roots.map((c) => {
          const replies = repliesOf(c.id);
          const shared = {
            replyTo, setReplyTo,
            reported, reportId, setReportId, reportWhy, setReportWhy, reportBusy, sendReport,
            adminToken, busyId, remove,
          };
          return (
            <li key={c.id} className="comment-thread">
              <Comment c={c} isFresh={fresh === c.id} {...shared} />
              {(replies.length > 0 || replyTo === c.id) && (
                <div className="comment-replies">
                  {replies.map((r) => <Comment key={r.id} c={r} isReply isFresh={fresh === r.id} {...shared} />)}
                  {replyTo === c.id && (
                    <CommentForm
                      targetKey={targetKey} targetLabel={targetLabel} parentId={c.id} compact
                      adminToken={adminToken}
                      onCancel={() => setReplyTo(null)}
                      onDone={(row) => { setList((l) => [...l, row]); setReplyTo(null); setFresh(row.id); }}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
