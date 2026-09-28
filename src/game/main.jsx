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
  HAND, deal, rng, israelDay, dayNumber, byTime, poolFor, availableTopics, availablePeriods,
  TOPICS, PERIODS,
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

/* הבחירה במשחק החופשי מתחילה ריקה, ונכנסת לתוקף רק בלחיצה על "הפעל".
   בגרסה הקודמת כל לחיצה על תחום ערבבה יד חדשה מיד - ולחיצה בטעות באמצע
   משחק מחקה אותו. עכשיו הבחירה היא טיוטה, והמשחק הרץ לא נוגע בה.
   אין שמירה בין ביקורים, בכוונה: כל כניסה מתחילה בבחירה. */
const EMPTY = { topics: [], periods: [], lead: null };

function ChipGroup({ label, items, selected, enabled, onChange }) {
  const toggle = (id) => onChange(selected.includes(id)
    ? selected.filter((x) => x !== id)
    : items.map((x) => x.id).filter((x) => x === id || selected.includes(x)));
  const open = items.filter((x) => enabled.includes(x.id)).map((x) => x.id);
  const all = open.length > 0 && open.every((x) => selected.includes(x));
  return (
    <fieldset className="gm-group">
      <legend>
        {label}
        <button type="button" className="gm-all" onClick={() => onChange(all ? [] : open)}>
          {all ? 'ניקוי' : 'בחירת הכל'}
        </button>
      </legend>
      <div className="gm-topics">
        {items.map((t) => {
          const off = !enabled.includes(t.id);
          return (
            <button
              key={t.id} type="button" className="gm-topic" disabled={off}
              aria-pressed={selected.includes(t.id)} onClick={() => toggle(t.id)}
              title={off ? 'אין פריטים בצירוף עם הבחירה השנייה' : undefined}
            >{t.label}</button>
          );
        })}
      </div>
    </fieldset>
  );
}

const PERIOD_ITEMS = PERIODS.map((p, i) => ({ id: i, label: p.name }));

function Settings({ draft, setDraft, onStart, onCancel }) {
  /* מה שנבחר ראשון מוביל, והשני מסונן לפיו - לא להפך. בחירה שנייה אף פעם
     לא מבטלת את הראשונה: מי שבחר "תקופת האבות" ואז "שופטים" לא יגלה
     שהתקופה נעלמה לו. כשהצד המוביל מתרוקן, ההובלה עוברת לצד השני. */
  const topicsOk = draft.lead === 'periods' ? availableTopics(draft.periods) : TOPICS.map((t) => t.id);
  const periodsOk = draft.lead === 'topics' ? availablePeriods(draft.topics) : PERIODS.map((_, i) => i);
  const setTopics = (topics) => {
    let lead = draft.lead || (topics.length ? 'topics' : null);
    if (lead === 'topics' && !topics.length) lead = draft.periods.length ? 'periods' : null;
    // שינוי בצד המוביל מוריד מהצד השני את מה שכבר אין בו אף פריט
    const periods = lead === 'topics'
      ? draft.periods.filter((i) => availablePeriods(topics).includes(i)) : draft.periods;
    setDraft({ topics, periods, lead });
  };
  const setPeriods = (periods) => {
    let lead = draft.lead || (periods.length ? 'periods' : null);
    if (lead === 'periods' && !periods.length) lead = draft.topics.length ? 'topics' : null;
    const topics = lead === 'periods'
      ? draft.topics.filter((t) => availableTopics(periods).includes(t)) : draft.topics;
    setDraft({ topics, periods, lead });
  };
  const ready = draft.topics.length > 0 && draft.periods.length > 0;
  const possible = ready && !!poolFor(draft.topics, draft.periods);
  return (
    <section className="gm-settings" aria-label="בחירת דמויות ותקופות">
      <ChipGroup
        label="על מי לשאול" items={TOPICS} selected={draft.topics} enabled={topicsOk}
        onChange={setTopics}
      />
      <ChipGroup
        label="מאילו תקופות" items={PERIOD_ITEMS} selected={draft.periods} enabled={periodsOk}
        onChange={setPeriods}
      />
      {ready && !possible && (
        <p className="gm-empty" role="status">
          אין בבחירה הזו חמישה פריטים שאפשר לסדר בלי חפיפה. הוסיפו תקופה או סוג דמויות.
        </p>
      )}
      {!ready && <p className="gm-hint">בחרו על מי לשאול ומאיזו תקופה - מה שבוחרים ראשון מסנן את השני.</p>}
      <div className="gm-actions">
        <button type="button" className="gm-btn primary" disabled={!possible} onClick={onStart}>הפעל</button>
        {onCancel && <button type="button" className="gm-btn" onClick={onCancel}>ביטול</button>}
      </div>
    </section>
  );
}

// שורת סיכום במקום הלוח המלא בזמן משחק - אין בה שום דבר שלחיצה בטעות משנה
function Summary({ applied, onEdit }) {
  const topics = TOPICS.filter((t) => applied.topics.includes(t.id)).map((t) => t.label);
  const periods = applied.periods.length === PERIODS.length ? 'כל התקופות'
    : applied.periods.length > 3 ? `${applied.periods.length} תקופות`
    : applied.periods.map((i) => PERIODS[i].name).join(', ');
  return (
    <div className="gm-summary">
      <span>{topics.length === TOPICS.length ? 'כל התחומים' : topics.join(', ')} · {periods}</span>
      <button type="button" className="gm-all" onClick={onEdit}>שינוי בחירה</button>
    </div>
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
  const [applied, setApplied] = useState(null); // הבחירה שהמשחק רץ עליה
  const [draft, setDraft] = useState(EMPTY);     // מה שמסומן כרגע בלוח הבחירה
  const [editing, setEditing] = useState(true);
  const [years, setYears] = useState(loadYears);
  const changeYears = (v) => {
    setYears(v);
    try { localStorage.setItem(YEARS_KEY, v); } catch { /* לא נורא */ }
  };

  const pool = useMemo(
    () => (daily || !applied ? null : poolFor(applied.topics, applied.periods)),
    [daily, applied],
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
  const start = () => {
    setApplied({ ...draft, periods: [...draft.periods].sort((x, y) => x - y) });
    setEditing(false); setRound((r) => r + 1); reset();
  };
  const edit = () => { setDraft(applied || EMPTY); setEditing(true); };
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
        mode: 'free', score: s, topics: applied.topics.join(','),
        periods: applied.periods.map((i) => PERIODS[i].id).join(','),
      });
    }
  };

  // אחרי האתגר היומי "סבב נוסף" עובר למשחק החופשי, ושם - לבחירה אם עוד לא נבחר כלום
  const next = () => {
    if (daily) { setDaily(false); if (!applied) setEditing(true); }
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
        {!daily && (editing || !applied
          ? <Settings draft={draft} setDraft={setDraft} onStart={start}
              onCancel={applied ? () => setEditing(false) : null} />
          : <Summary applied={applied} onEdit={edit} />)}
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
