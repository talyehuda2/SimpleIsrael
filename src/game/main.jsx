/* סדר את הציר - משחק קטן: חמישה פריטים, לסדר מהמוקדם למאוחר.
 *
 * נקודת כניסה חמישית, עצמאית: גיליון סגנונות משלו (game.css) ובלי שום
 * הסתמכות על styles.css - המלכודת שה-CLAUDE.md מזהיר ממנה.
 *
 * הגרירה הוחלפה בלחיצה: לחיצה על פריט מכניסה אותו למקום הפנוי הבא,
 * ולחיצה על פריט שכבר הונח מחזירה אותו. גרירה בטלפון נאבקת בגלילה,
 * ולחיצה עובדת גם במקלדת ובקורא מסך בלי קוד נוסף.
 *
 * האתגר היומי זהה לכל מי שמשחק באותו יום (זרע מהתאריך בשעון ישראל),
 * וזה מה שהופך את התוצאה לדבר ששווה לשתף: "4 מתוך 5, תצליחו?" */
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { itemKey } from '../data/items.js';
import { hebrewYearLetters } from '../utils/dates.js';
import { startTrail, mark, markOnce } from '../lib/trail.js';
import {
  HAND, deal, rng, israelDay, dayNumber, byTime, poolFor, TOPICS, ALL_TOPICS, PERIODS,
} from './pool.js';
import './game.css';

const KIND_LABEL = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך', judah: 'מלך יהודה',
  israel: 'מלך ישראל', prophet: 'נביא', event: 'אירוע', world: 'מלך זר',
};
// מה השנה מציינת - בלי זה "1948" ליד אברהם נקרא כשנת אירוע
const VERB = {
  leader: 'חי', judge: 'שפט', united: 'מלך', judah: 'מלך', israel: 'מלך',
  prophet: 'ניבא', world: 'מלך', event: '',
};

/* שלוש דרכים להציג את אותה שנה, לבחירת הגולש. כולן נגזרות מאותה שנה
   לבריאה לפי סדר עולם - גם "לפי מניינם" היא המרה של השנה הזו ולא
   הכרונולוגיה האקדמית (זו חיה בציר הזמן כמצב נפרד, עם נתונים משלה).

   הטווח המספרי עטוף ב-dir="ltr": בתוך שורה עברית אלגוריתם הכיווניות הופך
   את "2964–2981" ל-"2981–2964", ורחבעם נראה כמי שמלך אחורה בזמן */
const YEAR_MODES = [
  { id: 'heb', label: 'עברי' },
  { id: 'num', label: 'מספר לבריאה' },
  { id: 'sec', label: 'לפי מניינם' },
];

function secular(start, end) {
  const bce = (y) => 3761 - y, ce = (y) => y - 3760;
  if (start === end) return start < 3761 ? [`${bce(start)}`, 'לפנה"ס'] : [`${ce(start)}`, 'לספירה'];
  if (end < 3761) return [`${bce(start)}–${bce(end)}`, 'לפנה"ס'];
  if (start >= 3761) return [`${ce(start)}–${ce(end)}`, 'לספירה'];
  return [`${bce(start)} לפנה"ס – ${ce(end)} לספירה`, ''];
}

function When({ it, mode }) {
  const one = it.start === it.end;
  let text;
  if (mode === 'num') {
    text = <span dir="ltr">{one ? it.start : `${it.start}–${it.end}`}</span>;
  } else if (mode === 'sec') {
    const [range, era] = secular(it.start, it.end);
    text = era ? <><span dir="ltr">{range}</span> {era}</> : <span>{range}</span>;
  } else {
    text = one ? hebrewYearLetters(it.start)
      : `${hebrewYearLetters(it.start)}–${hebrewYearLetters(it.end)}`;
  }
  return <span className="gm-when">{VERB[it.kind] && `${VERB[it.kind]} `}{text}</span>;
}

const YEARS_KEY = 'si_game_years';
function loadYears() {
  try {
    const v = localStorage.getItem(YEARS_KEY);
    return YEAR_MODES.some((m) => m.id === v) ? v : 'heb';
  } catch { return 'heb'; }
}

function YearSwitch({ mode, onChange }) {
  return (
    <div className="gm-years" role="radiogroup" aria-label="הצגת השנים">
      <span className="gm-years-l" aria-hidden="true">שנים:</span>
      {YEAR_MODES.map((m) => (
        <button
          key={m.id} type="button" role="radio" aria-checked={mode === m.id}
          className="gm-year" onClick={() => onChange(m.id)}
        >{m.label}</button>
      ))}
    </div>
  );
}

const YEAR_NOTE = {
  heb: 'השנים לבריאה, לפי סדר עולם.',
  num: 'השנים לבריאה, לפי סדר עולם.',
  sec: 'השנים לפי מניינם, מחושבות מהשנה לבריאה לפי סדר עולם.',
};

// זרע מספרי מתוך מחרוזת התאריך
const seedOf = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

/* התוצאה של היום נשמרת בדפדפן, כדי שמי שחוזר לאתגר שכבר פתר יראה את
   התוצאה ולא יפתור שוב. אם האחסון חסום - פשוט משחקים מחדש. */
const SAVE = 'si_game_daily';
function loadDaily(day) {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE) || 'null');
    return s && s.day === day && Array.isArray(s.order) ? s.order : null;
  } catch { return null; }
}
function saveDaily(day, order) {
  try { localStorage.setItem(SAVE, JSON.stringify({ day, order })); } catch { /* לא נורא */ }
}

/* הבחירה במשחק החופשי נזכרת בין ביקורים - מי שאוהב נביאים לא צריך
   לבחור אותם מחדש בכל פעם. אחסון חסום = ברירת המחדל, כלום לא נשבר. */
const PREFS = 'si_game_prefs';
const DEFAULT_PREFS = { topics: ALL_TOPICS, from: 0, to: PERIODS.length - 1 };
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || 'null');
    const ok = p && Array.isArray(p.topics) && p.topics.length
      && p.topics.every((t) => ALL_TOPICS.includes(t))
      && Number.isInteger(p.from) && Number.isInteger(p.to)
      && p.from >= 0 && p.to < PERIODS.length && p.from <= p.to;
    return ok ? p : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* לא נורא */ }
}

function Settings({ prefs, onChange, empty }) {
  const toggle = (id) => {
    const has = prefs.topics.includes(id);
    // לפחות תחום אחד תמיד נשאר בחור - לוח ריק אינו משחק
    if (has && prefs.topics.length === 1) return;
    const topics = has ? prefs.topics.filter((t) => t !== id) : [...prefs.topics, id];
    onChange({ ...prefs, topics: ALL_TOPICS.filter((t) => topics.includes(t)) });
  };
  const setFrom = (v) => onChange({ ...prefs, from: v, to: Math.max(v, prefs.to) });
  const setTo = (v) => onChange({ ...prefs, to: v, from: Math.min(v, prefs.from) });
  return (
    <section className="gm-settings" aria-label="בחירת תחום ותקופה">
      <div className="gm-topics" role="group" aria-label="תחומים">
        {TOPICS.map((t) => (
          <button
            key={t.id} type="button" className="gm-topic"
            aria-pressed={prefs.topics.includes(t.id)} onClick={() => toggle(t.id)}
          >{t.label}</button>
        ))}
      </div>
      <div className="gm-range">
        <label>
          <span>מתקופה</span>
          <select value={prefs.from} onChange={(e) => setFrom(Number(e.target.value))}>
            {PERIODS.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
          </select>
        </label>
        <label>
          <span>עד</span>
          <select value={prefs.to} onChange={(e) => setTo(Number(e.target.value))}>
            {PERIODS.map((p, i) => <option key={p.id} value={i}>{p.name}</option>)}
          </select>
        </label>
      </div>
      {empty && (
        <p className="gm-empty" role="status">
          אין בבחירה הזו חמישה פריטים שאפשר לסדר בלי חפיפה. הרחיבו את טווח התקופות או הוסיפו תחום.
        </p>
      )}
    </section>
  );
}

function Chip({ kind }) {
  return <span className={`gm-chip ${kind}`}>{KIND_LABEL[kind]}</span>;
}

function Game() {
  const day = useMemo(() => israelDay(), []);
  const num = dayNumber(day);
  const [daily, setDaily] = useState(true);
  const [round, setRound] = useState(0); // מונה סבבים חופשיים - כל ערך הוא ערבוב חדש
  const [prefs, setPrefs] = useState(loadPrefs);
  const [years, setYears] = useState(loadYears);
  const changeYears = (v) => {
    setYears(v);
    try { localStorage.setItem(YEARS_KEY, v); } catch { /* לא נורא */ }
  };

  const pool = useMemo(
    () => (daily ? undefined : poolFor(prefs.topics, prefs.from, prefs.to)),
    [daily, prefs],
  );
  const hand = useMemo(() => {
    if (daily) return deal(rng(seedOf(day)));
    return pool ? deal(Math.random, pool) : [];
  }, [daily, day, pool, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placed, setPlaced] = useState([]);
  const [checked, setChecked] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  // שחזור האתגר היומי אם כבר נפתר היום
  useEffect(() => {
    if (!daily) return;
    const saved = loadDaily(day);
    const keys = new Set(hand.map(itemKey));
    if (saved && saved.length === HAND && saved.every((k) => keys.has(k))) {
      setPlaced(saved.map((k) => hand.find((h) => itemKey(h) === k)));
      setChecked(true);
    }
  }, [daily, day, hand]);

  useEffect(() => { markOnce('game_start', { mode: daily ? 'daily' : 'free' }); }, [daily]);

  const reset = () => { setPlaced([]); setChecked(false); setShareMsg(''); };
  const changePrefs = (p) => { setPrefs(p); savePrefs(p); reset(); };
  const switchMode = (toDaily) => {
    if (toDaily === daily) return;
    setDaily(toDaily); setRound(0); reset();
  };

  const answer = useMemo(() => [...hand].sort(byTime), [hand]);
  const right = placed.map((it, i) => itemKey(it) === itemKey(answer[i]));
  const score = right.filter(Boolean).length;
  const left = hand.filter((h) => !placed.includes(h));

  const place = (it) => { if (!checked) setPlaced((p) => [...p, it]); };
  const unplace = (it) => { if (!checked) setPlaced((p) => p.filter((x) => x !== it)); };

  const check = () => {
    setChecked(true);
    const s = placed.filter((it, i) => itemKey(it) === itemKey(answer[i])).length;
    if (daily) {
      markOnce('game_done', { mode: 'daily', score: s });
      saveDaily(day, placed.map(itemKey));
    } else {
      // כל סבב חופשי נספר, יחד עם הבחירה - כך רואים אילו תחומים מעניינים
      mark('game_done', {
        mode: 'free', score: s, topics: prefs.topics.join(','),
        range: `${PERIODS[prefs.from].id}..${PERIODS[prefs.to].id}`,
      });
    }
  };

  // אחרי האתגר היומי "סבב נוסף" עובר למשחק החופשי
  const next = () => {
    if (daily) setDaily(false);
    setRound((r) => r + 1); reset();
  };

  const share = async () => {
    const squares = right.map((ok) => (ok ? '🟩' : '🟥')).join('');
    const head = daily ? `סדר את הציר · אתגר #${num}` : 'סדר את הציר';
    const text = `${head}\n${squares} ${score}/${HAND}\nתצליחו יותר?`;
    const url = `${location.origin}/game?src=game-share`;
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (touch && navigator.share) {
      try { await navigator.share({ text: `${text}\n${url}` }); } catch { /* נסגר */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMsg('התוצאה הועתקה - אפשר להדביק בוואטסאפ');
    } catch {
      setShareMsg('ההעתקה נכשלה');
    }
  };

  const verdict = score === HAND ? 'מושלם! כל הפריטים במקום.'
    : score >= 3 ? 'כמעט - הנה הסדר הנכון:'
    : 'הציר מפתיע. הנה הסדר הנכון:';

  return (
    <>
      <header className="gm-bar">
        <a className="gm-home" href="/" title="לציר הזמן">📜 <span>ציר הזמן</span></a>
        <h1>סדר את הציר</h1>
        <span className="gm-num">{daily ? `אתגר #${num}` : 'משחק חופשי'}</span>
      </header>

      <main className="gm-main" id="main">
        <div className="gm-modes" role="tablist" aria-label="סוג משחק">
          <button type="button" role="tab" aria-selected={daily} className="gm-mode" onClick={() => switchMode(true)}>
            אתגר יומי
          </button>
          <button type="button" role="tab" aria-selected={!daily} className="gm-mode" onClick={() => switchMode(false)}>
            משחק חופשי
          </button>
        </div>
        {!daily && <Settings prefs={prefs} onChange={changePrefs} empty={!pool} />}
        {hand.length > 0 && (
          <>
        <p className="gm-lead">
          {checked
            ? <>
                <b>{score} מתוך {HAND}.</b> {verdict}
              </>
            : <>סדרו מהמוקדם למאוחר. לחיצה על פריט מכניסה אותו למקום הפנוי הבא, ולחיצה חוזרת מוציאה אותו.</>}
        </p>

        <ol className="gm-slots" aria-label="הציר שלכם, מהמוקדם למאוחר">
          {Array.from({ length: HAND }, (_, i) => {
            const it = placed[i];
            const edge = i === 0 ? 'הכי מוקדם' : i === HAND - 1 ? 'הכי מאוחר' : '';
            if (!it) {
              return (
                <li key={i} className="gm-slot empty">
                  <span className="gm-n">{i + 1}</span>
                  <span className="gm-ph">{edge}</span>
                </li>
              );
            }
            const ok = right[i];
            return (
              <li key={i} className={`gm-slot${checked ? (ok ? ' ok' : ' bad') : ''}`}>
                <span className="gm-n">{checked ? (ok ? '✓' : '✗') : i + 1}</span>
                <button
                  type="button" className="gm-card placed" onClick={() => unplace(it)}
                  disabled={checked}
                  aria-label={checked ? `${it.name}, ${ok ? 'במקום' : 'לא במקום'}` : `${it.name} - להוציא`}
                >
                  <span className="gm-name">{it.name}</span>
                  <Chip kind={it.kind} />
                  {checked && <When it={it} mode={years} />}
                </button>
              </li>
            );
          })}
        </ol>

        {!checked && left.length > 0 && (
          <div className="gm-pool" role="group" aria-label="פריטים שעוד לא סודרו">
            {left.map((it) => (
              <button key={itemKey(it)} type="button" className="gm-card" onClick={() => place(it)}>
                <span className="gm-name">{it.name}</span>
                <Chip kind={it.kind} />
              </button>
            ))}
          </div>
        )}

        {!checked && (
          <div className="gm-actions">
            <button type="button" className="gm-btn primary" disabled={placed.length < HAND} onClick={check}>
              בדיקה
            </button>
            {placed.length > 0 && (
              <button type="button" className="gm-btn" onClick={() => setPlaced([])}>ניקוי</button>
            )}
          </div>
        )}

        {checked && (
          <>
            <ol className="gm-answer" aria-label="הסדר הנכון">
              {answer.map((it) => (
                <li key={itemKey(it)}>
                  <a href={`/?sel=${itemKey(it)}&src=game`}>
                    <span className="gm-name">{it.name}</span>
                    <Chip kind={it.kind} />
                    <When it={it} mode={years} />
                    <span className="gm-go" aria-hidden="true">←</span>
                  </a>
                </li>
              ))}
            </ol>
            <YearSwitch mode={years} onChange={changeYears} />
            <p className="gm-note">{YEAR_NOTE[years]} לחיצה על פריט פותחת אותו בציר הזמן.</p>
            <div className="gm-actions">
              <button type="button" className="gm-btn primary" onClick={share}>שיתוף התוצאה</button>
              <button type="button" className="gm-btn" onClick={next}>סבב נוסף</button>
            </div>
            <p className="gm-msg" role="status">{shareMsg}</p>
            {daily && <p className="gm-note">אתגר חדש מחר בחצות.</p>}
          </>
        )}
          </>
        )}
      </main>
    </>
  );
}

startTrail();
createRoot(document.getElementById('root')).render(<Game />);
