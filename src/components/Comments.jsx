import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { getAdminToken } from '../lib/admin.js';

const MAX_LEN = 1000;
const MAX_NAME = 40;

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// טופס כתיבה — משמש גם לתגובה חדשה וגם לתשובה בתוך שרשור
function CommentForm({ targetKey, targetLabel, parentId = null, compact = false, onDone, onCancel }) {
  const [author, setAuthor] = useState('');
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
        hp: hp.current ? hp.current.value : '',
      })
      .select('id, created_at, author, body, parent_id')
      .single();
    setSending(false);
    if (error) { setErr('שליחת התגובה נכשלה, נסו שוב'); return; }
    setBody(''); setAuthor('');
    onDone(data);
  };

  return (
    <form className={`comment-form${compact ? ' compact' : ''}`} onSubmit={submit}>
      <input
        className="comment-name" type="text" placeholder="שם (אופציונלי)"
        value={author} maxLength={MAX_NAME} onChange={(e) => setAuthor(e.target.value)}
      />
      {/* honeypot — נסתר מבני-אדם, בוטים ממלאים אותו */}
      <input ref={hp} className="comment-hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <textarea
        className="comment-body"
        placeholder={parentId ? 'תשובה…' : 'הוסיפו הערה, מקור או תיקון…'}
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

export default function Comments({ targetKey, targetLabel }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [replyTo, setReplyTo] = useState(null);
  const [busyId, setBusyId] = useState(null);
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

  const remove = async (id) => {
    if (!adminToken) return;
    if (!window.confirm('למחוק את התגובה? (תשובות בשרשור יימחקו גם הן)')) return;
    setBusyId(id);
    const { error } = await supabase.rpc('admin_delete_comment', { p_id: id, p_token: adminToken });
    setBusyId(null);
    if (error) { window.alert('המחיקה נכשלה — ייתכן שטוקן הניהול שגוי.'); return; }
    // מסירים גם את התשובות שהיו תלויות בתגובה שנמחקה
    setList((l) => l.filter((c) => c.id !== id && c.parent_id !== id));
  };

  const roots = list.filter((c) => !c.parent_id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const repliesOf = (id) => list.filter((c) => c.parent_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const Comment = ({ c, isReply }) => (
    <li className={`comment${isReply ? ' reply' : ''}`}>
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
        {adminToken && (
          <button
            type="button" className="comment-link danger"
            disabled={busyId === c.id} onClick={() => remove(c.id)}
          >
            {busyId === c.id ? 'מוחק…' : '🗑 מחיקה'}
          </button>
        )}
      </div>
    </li>
  );

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
        <div className="comments-empty">אין עדיין תגובות — היו הראשונים להוסיף!</div>
      )}

      <ul className="comment-list">
        {roots.map((c) => (
          <div key={c.id} className="comment-thread">
            <Comment c={c} />
            {repliesOf(c.id).map((r) => <Comment key={r.id} c={r} isReply />)}
            {replyTo === c.id && (
              <div className="reply-box">
                <CommentForm
                  targetKey={targetKey} targetLabel={targetLabel} parentId={c.id} compact
                  onCancel={() => setReplyTo(null)}
                  onDone={(row) => { setList((l) => [...l, row]); setReplyTo(null); }}
                />
              </div>
            )}
          </div>
        ))}
      </ul>
    </section>
  );
}
