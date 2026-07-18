import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const MAX_LEN = 1000;
const MAX_NAME = 40;

function timeAgo(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Comments({ targetKey, targetLabel }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const hp = useRef(null); // honeypot

  // טעינת התגובות של הפריט הנבחר
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    supabase
      .from('comments')
      .select('id, created_at, author, body')
      .eq('target_key', targetKey)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setStatus('error'); return; }
        setList(data || []);
        setStatus('ready');
      });
    return () => { alive = false; };
  }, [targetKey]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const text = body.trim();
    if (!text) return;
    if (text.length > MAX_LEN) { setErr(`מקסימום ${MAX_LEN} תווים`); return; }
    setSending(true);
    const row = {
      target_key: targetKey,
      target_label: targetLabel || null,
      author: author.trim().slice(0, MAX_NAME) || null,
      body: text,
      hp: hp.current ? hp.current.value : '',
    };
    const { data, error } = await supabase
      .from('comments')
      .insert(row)
      .select('id, created_at, author, body')
      .single();
    setSending(false);
    if (error) { setErr('שליחת התגובה נכשלה, נסו שוב'); return; }
    setList((l) => [data, ...l]);
    setBody('');
  };

  return (
    <section className="comments">
      <h3 className="comments-title">
        תגובות{status === 'ready' && list.length > 0 ? ` (${list.length})` : ''}
      </h3>

      <form className="comment-form" onSubmit={submit}>
        <input
          className="comment-name"
          type="text"
          placeholder="שם (אופציונלי)"
          value={author}
          maxLength={MAX_NAME}
          onChange={(e) => setAuthor(e.target.value)}
        />
        {/* honeypot — נסתר מבני-אדם, בוטים ממלאים אותו */}
        <input
          ref={hp}
          className="comment-hp"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <textarea
          className="comment-body"
          placeholder="הוסיפו הערה, מקור או תיקון…"
          value={body}
          maxLength={MAX_LEN}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="comment-actions">
          <span className="comment-count">{body.length}/{MAX_LEN}</span>
          <button className="comment-submit" type="submit" disabled={sending || !body.trim()}>
            {sending ? 'שולח…' : 'פרסום'}
          </button>
        </div>
        {err && <div className="comment-err">{err}</div>}
      </form>

      {status === 'loading' && <div className="comments-empty">טוען תגובות…</div>}
      {status === 'error' && <div className="comments-empty">שגיאה בטעינת התגובות</div>}
      {status === 'ready' && list.length === 0 && (
        <div className="comments-empty">אין עדיין תגובות — היו הראשונים להוסיף!</div>
      )}

      <ul className="comment-list">
        {list.map((c) => (
          <li key={c.id} className="comment">
            <div className="comment-head">
              <span className="comment-author">{c.author || 'אנונימי'}</span>
              <span className="comment-date">{timeAgo(c.created_at)}</span>
            </div>
            <div className="comment-text">{c.body}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
