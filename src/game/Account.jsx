/* חשבון השחקן בממשק: כפתור בסרגל, חלון התחברות, אזור אישי וטבלת המובילים.

   הרשמה היא הזמנה ולא שער: אורח משחק בדיוק כמו קודם, והמשחק לא מחכה לשום
   קריאה לשרת. מה שההתחברות מוסיפה - נקודות, רצף וטבלה - נטען לצד המשחק.

   הסגנון ב-account.css, בבעלות הרכיבים האלה ולא ב-game.css. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { mark } from '../lib/trail.js';
import { AUTH_KEY, fetchBoard } from './board.js';
import './account.css';

/* דגל השקה, כמו ?modern=1 של המפה המודרנית: עד שההגדרות בדשבורד של Supabase
   ו-Google מוכנות, ההרשמה גלויה רק למי שנכנס עם ?accounts=1. הדגל נשמר בדפדפן,
   כי בחזרה מגוגל הכתובת מתחלפת. השקה לכולם = OPEN ל-true. */
const OPEN = false;
const FLAG = 'si_game_accounts';
export function accountsEnabled() {
  if (OPEN) return true;
  try {
    if (new URLSearchParams(location.search).has('accounts')) localStorage.setItem(FLAG, '1');
    return localStorage.getItem(FLAG) === '1';
  } catch { return false; }
}

const hasStoredSession = () => {
  try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; }
};
// חזרה מגוגל: ?code= (PKCE), או שגיאה שגוגל/Supabase החזירו בכתובת
const hasAuthParams = () => /[?&#](code|error_description)=/.test(location.search + location.hash);

/** מצב החשבון. account.js נטען רק כשיש סיבה - ראו שם. */
export function useAccount(enabled = true) {
  const mod = useRef(null);
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [known, setKnown] = useState(() => !enabled || (!hasStoredSession() && !hasAuthParams()));

  const load = useCallback(async () => {
    if (mod.current) return mod.current;
    const m = await import('./account.js');
    mod.current = m;
    m.sb.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setKnown(true);
      if (event === 'SIGNED_IN' && hasAuthParams()) {
        // הכתובת אחרי גוגל נושאת את הקוד - מנקים, כדי שרענון לא ינסה אותו שוב
        mark('game_auth', { step: 'login', via: 'google' });
        history.replaceState(null, '', '/game');
      }
    });
    return m;
  }, []);

  useEffect(() => {
    if (!known) load().catch(() => setKnown(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    if (!mod.current) return;
    try { setMe(await mod.current.me()); } catch { /* נשאר הישן */ }
  }, []);

  useEffect(() => {
    if (user) refresh(); else setMe(null);
  }, [user, refresh]);

  return { user, me, known, load, refresh, mod };
}

/* ---------------------------------------------------------------------- */

export function AccountButton({ acc, onOpen }) {
  if (!acc.known) return <span className="ac-btn ac-ghost" aria-hidden="true" />;
  if (!acc.user) {
    return (
      <button type="button" className="ac-btn" onClick={() => onOpen('signin', 'bar')}>
        <span aria-hidden="true">👤</span><span className="ac-btn-l">התחברות</span>
      </button>
    );
  }
  const streak = acc.me?.streak || 0;
  return (
    <button type="button" className="ac-btn in" onClick={() => onOpen('profile')}
      aria-label={`האזור האישי${acc.me ? `: ${acc.me.total} נקודות, רצף ${streak}` : ''}`}>
      <span aria-hidden="true">⭐</span><b>{acc.me ? acc.me.total : '…'}</b>
      {streak > 1 && <span className="ac-streak" aria-hidden="true">🔥{streak}</span>}
    </button>
  );
}

/* חלון אחד לכל הזרימות. <dialog> עם showModal: מלכודת פוקוס, Escape ורקע
   חסום באים מהדפדפן, וקורא מסך מכריז עליו כחלון. */
export function AccountDialog({ acc, view, onClose, onView, onChanged }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (view && !d.open) d.showModal();
    if (!view && d.open) d.close();
    /* הפוקוס לכותרת ולא לכפתור הראשון: אחרת showModal שם אותו על ✕ (עם
       טבעת פוקוס), וקורא מסך מתחיל מ"סגירה" במקום ממה שהחלון אומר */
    if (view) (d.querySelector('[data-autofocus]') || d.querySelector('h2'))?.focus();
  }, [view]);

  return (
    <dialog ref={ref} className="ac-dlg" onClose={onClose} aria-labelledby="ac-title"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="ac-body">
        <button type="button" className="ac-x" onClick={onClose} aria-label="סגירה">✕</button>
        {view === 'signin' && <SignIn acc={acc} />}
        {view === 'nick' && <Nickname acc={acc} onDone={() => { onChanged(); onClose(); }} />}
        {view === 'profile' && <Profile acc={acc} onView={onView} onClose={onClose} onChanged={onChanged} />}
      </div>
    </dialog>
  );
}

function SignIn({ acc }) {
  const [step, setStep] = useState('pick');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(await acc.load()); } catch (e) { setErr((await acc.load()).errText(e)); }
    setBusy(false);
  };

  const send = (e) => {
    e.preventDefault();
    run(async (m) => {
      await m.sendCode(email.trim());
      mark('game_auth', { step: 'code_sent' });
      setStep('code'); setCode('');
    });
  };
  const verify = (e) => {
    e.preventDefault();
    run(async (m) => {
      await m.verifyCode(email.trim(), code.replace(/\D/g, ''));
      mark('game_auth', { step: 'login', via: 'email' });
    });
  };
  const google = () => run((m) => m.signInGoogle());

  /* הכפתור הרשמי של גוגל (google.js), שמציג לשחקן simpleisrael.co.il ולא את
     הכתובת של Supabase. עד שהוא מצויר - ואם לא נטען בכלל - מוצג כפתור ההפניה */
  const gRef = useRef(null);
  const [gsi, setGsi] = useState(false);
  useEffect(() => {
    if (step !== 'pick') return;
    let live = true;
    import('./google.js')
      .then((g) => g.renderGoogleButton(gRef.current, (token, nonce) => run(async (m) => {
        await m.signInGoogleToken(token, nonce);
        mark('game_auth', { step: 'login', via: 'google' });
      })))
      .then(() => { if (live) setGsi(true); })
      .catch(() => { /* נשאר כפתור ההפניה */ });
    return () => { live = false; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (step === 'code') {
    return (
      <form onSubmit={verify}>
        <h2 id="ac-title" tabIndex={-1}>הקוד נשלח</h2>
        <p className="ac-p">שלחנו קוד ל-<b dir="ltr">{email.trim()}</b>. הקלידו אותו כאן.</p>
        <label className="ac-lbl" htmlFor="ac-code">קוד מהמייל</label>
        <input id="ac-code" className="ac-in ac-code" inputMode="numeric" autoComplete="one-time-code"
          dir="ltr" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
        {err && <p className="ac-err" role="alert">{err}</p>}
        <button type="submit" className="gm-btn primary ac-wide" disabled={busy || code.replace(/\D/g, '').length < 6}>
          {busy ? 'בודק…' : 'כניסה'}
        </button>
        <p className="ac-small">
          לא הגיע? בדקו בספאם, או{' '}
          <button type="button" className="gm-all" onClick={() => { setStep('pick'); setErr(''); }}>שלחו שוב</button>
        </p>
      </form>
    );
  }

  return (
    <>
      <h2 id="ac-title" tabIndex={-1}>שומרים את הנקודות</h2>
      <p className="ac-p">
        כל אתגר יומי שווה עד 5 נקודות. נרשמים פעם אחת, ואז הנקודות נצברות, הרצף נספר
        ואתם מופיעים בטבלת המובילים - מכל מכשיר.
      </p>
      <div ref={gRef} className="ac-gsi" hidden={!gsi} />
      <button type="button" className="ac-google" onClick={google} disabled={busy} hidden={gsi}>
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </svg>
        המשך עם Google
      </button>
      <div className="ac-or"><span>או במייל</span></div>
      <form onSubmit={send}>
        <label className="ac-lbl" htmlFor="ac-email">כתובת מייל</label>
        <input id="ac-email" className="ac-in" type="email" autoComplete="email" dir="ltr"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <p className="ac-small">נשלח אליכם קוד בן 6 ספרות. בלי סיסמה.</p>
        {err && <p className="ac-err" role="alert">{err}</p>}
        <button type="submit" className="gm-btn primary ac-wide" disabled={busy || !email.includes('@')}>
          {busy ? 'שולח…' : 'שלחו לי קוד'}
        </button>
      </form>
      <p className="ac-small ac-legal">
        המייל משמש להתחברות בלבד ואינו מוצג. בטבלה מופיע רק הכינוי שתבחרו.{' '}
        <a href="/privacy" target="_blank" rel="noopener">מדיניות הפרטיות</a>
      </p>
    </>
  );
}

function Nickname({ acc, onDone }) {
  const first = !acc.me?.nickname;
  const [nick, setNick] = useState(acc.me?.nickname || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const m = await acc.load();
      await m.setNickname(nick);
      mark('game_auth', { step: 'nickname' });
      await acc.refresh();
      onDone();
    } catch (ex) {
      setErr((await acc.load()).errText(ex));
    }
    setBusy(false);
  };
  return (
    <form onSubmit={save}>
      <h2 id="ac-title" tabIndex={-1}>{first ? 'איך לקרוא לכם בטבלה?' : 'שינוי כינוי'}</h2>
      {first && <p className="ac-p">הכינוי מופיע בטבלת המובילים, לכל מי שנכנס למשחק. לא חייב להיות השם האמיתי.</p>}
      <label className="ac-lbl" htmlFor="ac-nick">כינוי</label>
      <input id="ac-nick" className="ac-in" maxLength={20} value={nick} autoComplete="nickname"
        onChange={(e) => setNick(e.target.value)} data-autofocus required />
      <p className="ac-small">2 עד 20 תווים: אותיות, ספרות, רווח, נקודה ומקף.</p>
      {err && <p className="ac-err" role="alert">{err}</p>}
      <button type="submit" className="gm-btn primary ac-wide" disabled={busy || nick.trim().length < 2}>
        {busy ? 'שומר…' : 'שמירה'}
      </button>
    </form>
  );
}

const shortDay = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('he-IL', { weekday: 'narrow', timeZone: 'UTC' });

function Profile({ acc, onView, onClose, onChanged }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const me = acc.me;
  if (!me) return <p className="ac-p" id="ac-title">טוען…</p>;

  const out = async () => { await (await acc.load()).signOut(); onChanged(); onClose(); };
  const del = async () => {
    setBusy(true); setErr('');
    try {
      await (await acc.load()).deleteMe();
      mark('game_auth', { step: 'delete' });
      onChanged(); onClose();
    } catch (e) { setErr((await acc.load()).errText(e)); setBusy(false); }
  };

  return (
    <>
      <h2 id="ac-title" tabIndex={-1}>{me.nickname || 'האזור האישי'}</h2>
      <dl className="ac-stats">
        <div><dt>נקודות</dt><dd>{me.total}</dd></div>
        <div><dt>רצף</dt><dd>{me.streak > 0 && <span aria-hidden="true">🔥</span>}{me.streak}</dd></div>
        <div><dt>שיא רצף</dt><dd>{me.best}</dd></div>
        <div><dt>אתגרים</dt><dd>{me.days}</dd></div>
      </dl>
      {me.recent?.length > 0 && (
        <>
          <h3 className="ac-h3">התוצאות האחרונות</h3>
          {/* שבע ולא ארבע-עשרה: יותר מזה נשבר לשתי שורות בטלפון צר */}
          <ol className="ac-recent">
            {me.recent.slice(-7).map((r) => (
              <li key={r.day} className={r.score === 5 ? 'top' : r.score >= 3 ? 'good' : ''}
                aria-label={`${r.day}: ${r.score} מתוך 5`}>
                <b>{r.score}</b><span aria-hidden="true">{shortDay(r.day)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="ac-small">הרצף נספר כל יום שבו פותרים את האתגר היומי. יום שמדלגים עליו מאפס אותו.</p>
      <div className="ac-row">
        <button type="button" className="gm-btn" onClick={() => onView('nick')}>שינוי כינוי</button>
        <button type="button" className="gm-btn" onClick={out}>התנתקות</button>
      </div>
      {!confirm ? (
        <button type="button" className="gm-all ac-del" onClick={() => setConfirm(true)}>מחיקת החשבון</button>
      ) : (
        <div className="ac-confirm" role="group" aria-label="אישור מחיקה">
          <p>החשבון, הכינוי וכל הנקודות יימחקו לצמיתות. אי אפשר לשחזר.</p>
          {err && <p className="ac-err" role="alert">{err}</p>}
          <div className="ac-row">
            <button type="button" className="gm-btn ac-danger" onClick={del} disabled={busy}>
              {busy ? 'מוחק…' : 'כן, למחוק'}
            </button>
            <button type="button" className="gm-btn" onClick={() => setConfirm(false)}>ביטול</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */

/** ההזמנה במסך התוצאה, לאורח - הרגע שבו יש לו בדיוק מה לשמור */
export function SaveInvite({ score, onOpen }) {
  // גם יום של 0 נספר לרצף - ולכן ההזמנה לא נעלמת בציון נמוך, רק משנה ניסוח
  const what = score > 1 ? <><b>{score} נקודות</b> מחכות לכם.</> : score === 1 ? <><b>נקודה אחת</b> מחכה לכם.</> : 'גם יום קשה נספר לרצף.';
  return (
    <div className="ac-invite">
      <p>{what} נרשמים, והתוצאה נשמרת - יחד עם רצף ימים ומקום בטבלה.</p>
      <button type="button" className="gm-btn" onClick={() => onOpen('signin', 'result')}>שמירת הנקודות</button>
    </div>
  );
}

/** שורת המצב במסך התוצאה, לשחקן מחובר - רק בזמן שמירה או כשנכשלה. שמירה
    שהצליחה מוצגת כתגית ⭐ בשורת התגיות של המשחק, ולא כשורה נוספת */
export function SavedLine({ state }) {
  if (state === 'saving') return <p className="ac-saved">שומר את התוצאה…</p>;
  if (state && state !== 'saved') return <p className="ac-saved bad" role="alert">{state}</p>;
  return null;
}

export function Leaderboard({ acc, version, onOpen }) {
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const token = acc.user && acc.mod.current ? await acc.mod.current.accessToken() : null;
        const d = await fetchBoard(range, token);
        if (live) { setData(d); setFailed(false); }
      } catch { if (live) setFailed(true); }
    })();
    return () => { live = false; };
  }, [range, acc.user, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // חמישה ראשונים, והשאר בלחיצה: הטבלה יושבת מיד אחרי התוצאה ולא צריכה לדחוק את התשובות
  const [all, setAll] = useState(false);

  // אם השרת לא זמין, הטבלה פשוט לא מופיעה - המשחק עצמו לא תלוי בה
  if (failed && !data) return null;
  const rows = all ? data?.top || [] : (data?.top || []).slice(0, 5);
  const meOut = data?.me && !rows.some((r) => r.me);

  return (
    <section className="ac-board" aria-labelledby="ac-board-h">
      <div className="ac-board-head">
        <h2 id="ac-board-h">🏆 טבלת המובילים</h2>
        <div className="ac-tabs" role="tablist" aria-label="טווח">
          <button type="button" role="tab" aria-selected={range === 'week'} onClick={() => setRange('week')}>השבוע</button>
          <button type="button" role="tab" aria-selected={range === 'all'} onClick={() => setRange('all')}>מאז ומעולם</button>
        </div>
      </div>
      {!data ? (
        <p className="ac-small">טוען…</p>
      ) : data.top.length === 0 ? (
        <p className="ac-small">{range === 'week' ? 'השבוע עוד לא נרשמו נקודות. הראשון בטבלה יכול להיות אתם.' : 'עוד אין שחקנים רשומים.'}</p>
      ) : (
        <ol className="ac-rows">
          {rows.map((r) => (
            <li key={`${r.rank}-${r.nickname}`} className={r.me ? 'me' : ''}>
              <span className="ac-rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
              <span className="ac-nick">{r.nickname}</span>
              <span className="ac-pts"><b>{r.points}</b> נק׳</span>
            </li>
          ))}
          {meOut && (
            <li className="me gap">
              <span className="ac-rank">{data.me.rank}</span>
              <span className="ac-nick">{acc.me?.nickname || 'אתם'}</span>
              <span className="ac-pts"><b>{data.me.points}</b> נק׳</span>
            </li>
          )}
        </ol>
      )}
      {data?.top.length > 5 && (
        <button type="button" className="gm-all" onClick={() => setAll((v) => !v)}>
          {all ? 'פחות' : `הצגת כל ה-${data.top.length}`}
        </button>
      )}
      {range === 'week' && <p className="ac-small">השבוע מתחיל ביום ראשון. רק האתגר היומי נספר.</p>}
      {acc.known && !acc.user && (
        <button type="button" className="gm-all" onClick={() => onOpen('signin', 'board')}>להצטרף לטבלה</button>
      )}
    </section>
  );
}
