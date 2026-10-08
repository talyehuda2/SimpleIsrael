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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { itemKey } from '../data/items.js';
import { hebrewYearLetters } from '../utils/dates.js';
import { startTrail, mark, markOnce } from '../lib/trail.js';
import ChannelCard from '../components/ChannelCard.jsx';
import {
  HAND, deal, rng, seedOf, israelDay, dayNumber, byTime, poolFor, availableTopics, availablePeriods,
  TOPICS, PERIODS,
} from './pool.js';
import { confetti } from './confetti.js';
import './game.css';
import { useAccount, accountsEnabled, AccountButton, AccountDialog, SaveInvite, SavedLine, Leaderboard, guestRank } from './Account.jsx';

// עד ההשקה ההרשמה כולה מוסתרת - ראו OPEN ב-Account.jsx
const ACCOUNTS = accountsEnabled();

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

/* רצף ימים באתגר היומי - מה שגורם לחזור מחר. נספר כל יום שבו האתגר נפתר,
   בלי קשר לציון: רצף שנשבר על 2/5 היה מעניש דווקא את מי שעוד לומד. נשמר
   במכשיר בלבד, לפי מספר האתגר (dayNumber) ולא לפי שעון הטלפון. */
const STREAK = 'si_game_streak';
function loadStreak() {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK) || 'null');
    return s && Number.isInteger(s.last) ? s : { last: 0, count: 0, best: 0 };
  } catch { return { last: 0, count: 0, best: 0 }; }
}
// הרצף "חי" אם האתגר האחרון שנפתר הוא של היום או של אתמול
const liveStreak = (s, num) => (s.last === num || s.last === num - 1 ? s.count : 0);
function bumpStreak(num) {
  const s = loadStreak();
  if (s.last === num) return s;
  const count = s.last === num - 1 ? s.count + 1 : 1;
  const next = { last: num, count, best: Math.max(s.best || 0, count) };
  try { localStorage.setItem(STREAK, JSON.stringify(next)); } catch { /* מצב פרטי - בלי רצף */ }
  return next;
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

/* כמה נשאר עד האתגר הבא - חצות בשעון ישראל, כמו israelDay. ספירה לאחור
   במקום "מחר בחצות": מספר שזז נותן סיבה מוחשית לחזור. מתעדכן כל חצי דקה */
function untilMidnight() {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date()).split(':').map(Number);
  const left = 24 * 60 - (h * 60 + m);
  return left >= 60
    ? { n: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, unit: 'שע׳' }
    : { n: String(left), unit: 'דק׳' };
}
function Countdown() {
  const [t, setT] = useState(untilMidnight);
  useEffect(() => { const id = setInterval(() => setT(untilMidnight()), 30000); return () => clearInterval(id); }, []);
  // "3:07" ב-ltr: בתוך שורה עברית הנקודתיים הופכות את הסדר ל-"07:3"
  return <><span dir="ltr">{t.n}</span> {t.unit}</>;
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
  const [streak, setStreak] = useState(loadStreak);
  const streakNow = liveStreak(streak, num);

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

  /* ----- חשבון: נקודות, רצף וטבלה (Account.jsx). רק האתגר היומי נספר ----- */
  const acc = useAccount(ACCOUNTS);
  const [view, setView] = useState(null);         // החלון הפתוח: signin / nick / profile
  const [saveState, setSaveState] = useState(null); // null / 'saving' / 'saved' / הודעת שגיאה
  const [boardV, setBoardV] = useState(0);        // מרענן את הטבלה אחרי שינוי
  const [month, setMonth] = useState(null);       // הטבלה החודשית, למקום של אורח בהזמנה
  const open = (v, via) => { if (v === 'signin') mark('game_auth', { step: 'open', via }); setView(v); };
  const changed = () => { acc.refresh(); setBoardV((n) => n + 1); };
  const byKeys = (keys) => keys.map((k) => hand.find((h) => itemKey(h) === k)).filter(Boolean);

  /* הסדר נשלח לשרת, שמחשב את הציון ושומר. התשובה היא מה שנשמר: אם כבר שוחק
     היום ממכשיר אחר, הציון ההוא קובע ולא זה. */
  const submit = useCallback(async (keys) => {
    setSaveState('saving');
    try {
      const res = await (await acc.load()).submitDaily(day, keys);
      saveDaily(day, res.placed);
      setSaveState('saved');
      acc.refresh(); setBoardV((n) => n + 1);
      return res;
    } catch (e) {
      setSaveState(e?.message || 'השמירה נכשלה');
      return null;
    }
  }, [acc.load, acc.refresh, day]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!daily || !acc.me) return;
    const keys = new Set(hand.map(itemKey));
    const server = acc.me.today?.placed;
    if (server) {
      // כבר פתר היום, אולי במכשיר אחר: מציגים את מה שנשמר ולא נותנים ניסיון נוסף
      if (!checked && server.every((k) => keys.has(k))) {
        setPlaced(byKeys(server)); setChecked(true); saveDaily(day, server); setSaveState('saved');
      }
      return;
    }
    /* פתר כאורח ואז נרשם, או שהשמירה הקודמת נכשלה: שולחים את הסדר ששמור
       בדפדפן - אותו סדר שנבחר לפני שהתשובה נחשפה, ולא סדר חדש */
    const local = loadDaily(day);
    if (local && saveState === null && local.every((k) => keys.has(k))) submit(local);
  }, [acc.me, daily]); // eslint-disable-line react-hooks/exhaustive-deps

  // מי שנכנס בלי כינוי מתבקש לבחור אחד - גם בחזרה מגוגל, כשהחלון לא היה פתוח
  useEffect(() => {
    if (!acc.user || !acc.me) return;
    if (!acc.me.nickname) setView('nick');
    else if (view === 'signin') setView(null);
  }, [acc.user, acc.me]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!acc.user) setSaveState(null); }, [acc.user]);

  /* רצף אחד על המסך, לא שניים: של החשבון למי שמחובר (נכון בכל מכשיר שבו
     ישחק), ושל המכשיר לאורח. בלי זה שחקן מחובר ראה שני מספרים שונים -
     למשל אחרי ששיחק אתמול בטלפון והיום במחשב. fromYesterday = הרצף נמשך
     עד אתמול והיום עוד לא נפתר, כלומר יש מה להפסיד. */
  const run = acc.me
    ? { now: acc.me.streak, best: acc.me.best, fromYesterday: !acc.me.today }
    : { now: streakNow, best: streak.best, fromYesterday: streak.last === num - 1 };

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
    /* התוצאה יושבת בראש המסך - גוללים אליה, כדי שמי שלחץ "בדיקה" בתחתית הרשימה
       יראה מיד את הציון ואת כפתור השיתוף. קונפטי רק כשיש מה לחגוג: מלא על 5,
       מתון על 3-4, ובלי על פחות - שם ההודעה מזמינה לנסות שוב. */
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (s === HAND) confetti(170);
    else if (s >= 3) confetti(60);
    /* "איפה טועים": היד כולה בסדר הנכון, ומה שלא הונח במקומו. בלי היד אי אפשר
       לדעת אם פריט נכשל הרבה כי הוא קשה או רק כי הופיע הרבה - מסך הניהול
       מחלק טעויות בהופעות. מפתחות ולא שמות, כדי שיישארו קצרים ויציבים. */
    const facts = {
      hand: answer.map(itemKey).join(','),
      miss: placed.filter((it, i) => itemKey(it) !== itemKey(answer[i])).map(itemKey).join(','),
    };
    if (daily) {
      const st = bumpStreak(num);
      setStreak(st);
      markOnce('game_done', { mode: 'daily', score: s, n: num, streak: st.count, ...facts });
      const keys = placed.map(itemKey);
      saveDaily(day, keys);
      if (acc.user) {
        submit(keys).then((res) => {
          if (res && res.placed.join() !== keys.join()) setPlaced(byKeys(res.placed));
        });
      }
    } else {
      // כל סבב חופשי נספר, יחד עם הבחירה - כך רואים אילו תחומים מעניינים
      mark('game_done', {
        mode: 'free', score: s, topics: applied.topics.join(','),
        periods: applied.periods.map((i) => PERIODS[i].id).join(','), ...facts,
      });
    }
  };

  // אחרי האתגר היומי "סבב נוסף" עובר למשחק החופשי, ושם - לבחירה אם עוד לא נבחר כלום
  const next = () => {
    if (daily) { setDaily(false); if (!applied) setEditing(true); }
    setRound((r) => r + 1); reset();
  };

  /* ההודעה שנשלחת. *כוכביות* הן הדגשה בוואטסאפ. הקישור הוא לעמוד התוצאה
     (/game-result/<ציון>), שנושא כרטיס שיתוף עם הציון בעיצוב האתר ומעביר
     מיד למשחק - ראו prerender. */
  const share = async () => {
    const squares = right.map((ok) => (ok ? '🟩' : '🟥')).join('');
    const fire = daily && run.now >= 2 ? ` · 🔥 ${run.now} ימים ברצף` : '';
    const head = daily ? `🧭 *סדר את הציר* · אתגר #${num}${fire}` : '🧭 *סדר את הציר* · משחק חופשי';
    const text = `${head}\n${squares}  ${score}/${HAND} - ${result.head}\nמה קרה קודם? נסו לנצח אותי 👇`;
    const url = `${location.origin}/game-result/${score}`;
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    const mode = daily ? 'daily' : 'free';
    if (touch && navigator.share) {
      // נספר רק שיתוף שהושלם: ביטול חלון השיתוף זורק, ואז לא נרשם דבר
      try { await navigator.share({ text: `${text}\n${url}` }); mark('game_share', { mode, score, via: 'native' }); } catch { /* נסגר */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      mark('game_share', { mode, score, via: 'copy' });
      setShareMsg('✓ התוצאה הועתקה - הדביקו בוואטסאפ');
    } catch {
      setShareMsg('ההעתקה נכשלה');
    }
  };

  const RESULT = {
    5: { icon: '🎉', head: 'מושלם!', text: 'כל הפריטים במקום. שתפו ותראו מי מצליח כמוכם.' },
    4: { icon: '👏', head: 'כמעט מושלם!', text: 'רק פריט אחד זז ממקומו.' },
    3: { icon: '👍', head: 'יפה מאוד!', text: 'רוב הציר במקום.' },
  };
  const result = RESULT[score] || { icon: '🧭', head: 'הציר מפתיע', text: 'הנה הסדר הנכון - בסבב הבא זה כבר יהיה מוכר.' };

  return (
    <>
      <header className="gm-bar">
        {/* בטלפון היה כאן רק 📜 בלי מילה, ומי שהגיע מקישור לא הבין שזו הדרך לאתר.
            עכשיו חץ חזרה ומילה גם במסך הצר */}
        <a className="gm-home" href="/?src=game" aria-label="חזרה לאתר - ציר הזמן של עם ישראל">
          {/* החץ מצויר ולא תו "→": כל טלפון מצייר את התו בגופן אחר ובגובה אחר, והוא
              ישב מעל או מתחת למילה. אייקון ב-flex מתמרכז בדיוק */}
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false">
            <path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="gm-home-s">לאתר</span><span className="gm-home-l">ציר הזמן של עם ישראל</span>
        </a>
        <h1>סדר את הציר</h1>
        <div className="gm-end">
          <span className="gm-num">{daily ? `אתגר #${num}` : 'משחק חופשי'}</span>
          {ACCOUNTS && <AccountButton acc={acc} onOpen={open} />}
        </div>
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
        {checked ? (
          <section className={`gm-result${score === HAND ? ' perfect' : score >= 3 ? ' good' : ''}`} aria-live="polite">
            <div className="gm-r-icon" aria-hidden="true">{result.icon}</div>
            <div className="gm-r-score"><b>{score}</b> מתוך {HAND}</div>
            <div className="gm-r-head">{result.head}</div>
            <p className="gm-r-text">{result.text}</p>
            {/* התוצאה כציר קטן - חרוזים על קו זהב, ולא ריבועי אימוג'י */}
            <ol className="gm-r-line" aria-label={`${score} מתוך ${HAND} במקום הנכון`}>
              {right.map((ok, i) => (
                <li key={i} className={ok ? 'ok' : 'bad'} aria-hidden="true">{ok ? '✓' : '✗'}</li>
              ))}
            </ol>
            {/* שיתוף הוא הפעולה היחידה בגודל מלא. "סבב נוסף" באתגר היומי הוא קישור
                קטן - שני כפתורים שווים התחרו זה בזה. במשחק החופשי סבב נוסף הוא הלולאה
                עצמה, ולכן שם הוא נשאר כפתור */}
            <div className="gm-r-actions">
              <button type="button" className="gm-btn primary big" onClick={share}>📤 שיתוף התוצאה</button>
              {!daily && <button type="button" className="gm-btn" onClick={next}>סבב נוסף</button>}
            </div>
            <p className="gm-msg" role="status">{shareMsg}</p>
            {/* ההזמנה להירשם מיד אחרי השיתוף, לפני התגיות - שם היא נראית */}
            {ACCOUNTS && !acc.user && acc.known && (
              <SaveInvite score={score} daily={daily} rank={daily ? guestRank(month, score) : null} onOpen={open} />
            )}
            {/* שלוש שורות קטנות (רצף, "נשמר", "אתגר חדש מחר") הפכו לשורת תגיות אחת */}
            {daily && (
              <ul className="gm-chips">
                <li>
                  <span aria-hidden="true">🔥</span>{' '}
                  {run.now >= 2 ? <><b>{run.now}</b> ימים ברצף</> : <>יום <b>1</b> ברצף</>}
                  {run.best > run.now && <> · שיא {run.best}</>}
                </li>
                {ACCOUNTS && acc.me && saveState === 'saved' && (
                  <li><span aria-hidden="true">⭐</span> <b>{acc.me.total}</b> נק׳</li>
                )}
                <li><span aria-hidden="true">⏱</span> הבא בעוד <Countdown /></li>
              </ul>
            )}
            {ACCOUNTS && daily && acc.user && <SavedLine state={saveState} />}
            {daily && <button type="button" className="gm-more" onClick={next}>סבב נוסף במשחק החופשי ←</button>}
            {/* מי שפתר את האתגר כבר אמר שהוא רוצה לחזור מחר - הרגע הנכון להציע את הערוץ.
                רק באתגר היומי: בחופשי זה היה חוזר בכל סבב */}
            {daily && <ChannelCard from="game" title="הצטרפו לערוץ בוואטסאפ" />}
          </section>
        ) : (
          <>
          {daily && run.now >= 1 && run.fromYesterday && (
            <p className="gm-streak pre"><span aria-hidden="true">🔥</span> רצף של <b>{run.now}</b> {run.now === 1 ? 'יום' : 'ימים'} - פתרו היום כדי להמשיך אותו</p>
          )}
          <p className="gm-lead">סדרו מהמוקדם למאוחר. לחיצה על פריט מכניסה אותו למקום הפנוי הבא, ולחיצה חוזרת מוציאה אותו.</p>
          </>
        )}
        {/* אחרי "כמה קיבלתי" השאלה הבאה היא "איפה אני", ולא רשימת התשובות */}
        {ACCOUNTS && checked && <Leaderboard acc={acc} version={boardV} onOpen={open} onMonth={setMonth} ghost={daily ? score : null} />}

        {!checked && (
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
        )}

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

        {/* רשימה אחת ולא שתיים: הסדר הנכון, ועל כל פריט אם הונח במקומו. קודם היו
            "הציר שלכם" ו"הסדר הנכון" זו אחר זו - וב-5/5 הן היו זהות לגמרי */}
        {checked && (
          <>
            <div className="gm-ans-head">
              <h2 className="gm-sub">הסדר הנכון</h2>
              <YearSwitch mode={years} onChange={changeYears} />
            </div>
            <ol className="gm-answer" aria-label="הסדר הנכון">
              {answer.map((it, i) => {
                const at = placed.findIndex((p) => itemKey(p) === itemKey(it));
                const ok = at === i;
                return (
                  <li key={itemKey(it)} className={ok ? 'ok' : 'bad'}>
                    <span className="gm-n" aria-hidden="true">{ok ? '✓' : '✗'}</span>
                    <a href={`/?sel=${itemKey(it)}&src=game`}
                      aria-label={`${it.name}, ${ok ? 'במקום' : `שמתם במקום ${at + 1}`}`}>
                      <span className="gm-name">{it.name}</span>
                      <Chip kind={it.kind} />
                      {!ok && at >= 0 && <span className="gm-was">שמתם במקום {at + 1}</span>}
                      <When it={it} mode={years} />
                      <span className="gm-go" aria-hidden="true">←</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="gm-note">{YEAR_NOTE[years]} לחיצה על פריט פותחת אותו בציר הזמן.</p>
          </>
        )}
          </>
        )}
        {ACCOUNTS && !checked && <Leaderboard acc={acc} version={boardV} onOpen={open} onMonth={setMonth} />}
        {/* מי שהגיע למשחק מקישור בוואטסאפ לא ראה את האתר מעולם. בסוף העמוד - שלוש
            הדלתות אליו, באותן מילים ואייקונים של מתג המבטים בשאר המסכים. שורה אחת
            של קישורים קטנים: שלושה קלפים גדולים תפסו מסך שלם בטלפון */}
        <nav className="gm-site" aria-label="ממשיכים באתר">
          <h2>ממשיכים באתר</h2>
          <div className="gm-site-row">
            <a href="/?src=game" title="מי חי מתי, ומי לצד מי">📜 ציר הזמן</a>
            <a href="/atlas?src=game" title="דמות אחר דמות, עם המפה והסיפור">🗺️ מסע הדורות</a>
            <a href="/places?src=game" title="מה קרה בכל מקום">📍 מפת הארץ</a>
          </div>
        </nav>
      </main>
      {ACCOUNTS && <AccountDialog acc={acc} view={view} onClose={() => setView(null)} onView={setView} onChanged={changed} />}
    </>
  );
}

startTrail();
createRoot(document.getElementById('root')).render(<Game />);
