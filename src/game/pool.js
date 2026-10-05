/* בחירת הקלפים למשחק "סדר את הציר" - בלי React, כדי שאפשר יהיה לבדוק
   אותו ב-node לבד.

   הכלל שמחזיק את כל המשחק: **אין שני קלפים שחופפים בזמן.** בלי זה הסדר
   תלוי בפרשנות - משה נולד לפני יציאת מצרים אבל היה בה, ו"מה קודם" הופך
   לוויכוח. כשהטווחים זרים זה לזה, התשובה אחת בין אם קוראים את השנה
   כלידה, כתחילת מלוכה או כתחילת נבואה. */
import { ALL_ITEMS, overlaps, SORTED_PERIODS } from '../data/items.js';

// ספרים ומלכויות עולמיות נשארים בחוץ: שנת ספר היא התקופה שהוא מתאר ולא
// אירוע, ומלכות נמשכת מאות שנים וחופפת כמעט הכל
const KINDS = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'event', 'world']);

/* מהסוגים הגדולים נכנסים רק מי שאדם שלמד תנ"ך בבית ספר מכיר. בלי הסינון
   יד טיפוסית הייתה "יהושפט, יותם, שלמנאסר, נדב" - חידון שמות ולא ציר,
   והשם לבדו גם אינו חד-משמעי: יואש, אחזיהו ויהואחז מלכו גם ביהודה וגם
   בישראל. האבות, המלכים של הממלכה המאוחדת והאירועים נכנסים כולם. */
const FAMILIAR = new Set([
  // שופטים
  'dvora', 'gidon', 'yiftach', 'shimshon', 'eli',
  // מלכי יהודה
  'rechavam', 'atalya', 'uziyahu', 'chizkiyahu', 'menashe', 'yoshiyahu', 'tzidkiyahu',
  // מלכי ישראל
  'yeravam1', 'achav', 'yehu',
  // נביאים
  'chana', 'shmuel', 'natan', 'eliyahu', 'elisha', 'yona', 'yeshayahu', 'yirmiyahu', 'yechezkel', 'daniel',
  // מלכים זרים
  'sancheriv-w', 'nevuchadnetzar', 'koresh-w', 'achashverosh', 'alexander-w', 'antiochus', 'titus',
]);
const ALL_IN = new Set(['leader', 'united', 'event']);
const familiar = (it) => ALL_IN.has(it.kind) || FAMILIAR.has(it.id);

const CANDIDATES = ALL_ITEMS.filter((it) => KINDS.has(it.kind));
export const POOL = CANDIDATES.filter(familiar);

export const HAND = 5;

/* התחומים שהגולש בוחר במשחק החופשי. מלכי יהודה, ישראל והממלכה המאוחדת
   הם תחום אחד: מי שבוחר "מלכים" לא חושב על החלוקה בין הממלכות. */
export const TOPICS = [
  { id: 'avot', label: 'אבות ומנהיגים', kinds: ['leader'] },
  { id: 'judges', label: 'שופטים', kinds: ['judge'] },
  { id: 'kings', label: 'מלכי ישראל ויהודה', kinds: ['united', 'judah', 'israel'] },
  { id: 'prophets', label: 'נביאים', kinds: ['prophet'] },
  { id: 'world', label: 'מלכים זרים', kinds: ['world'] },
  { id: 'events', label: 'אירועים', kinds: ['event'] },
];
export const ALL_TOPICS = TOPICS.map((t) => t.id);

export { SORTED_PERIODS as PERIODS };

// מחולל אקראי עם זרע, כדי שהאתגר היומי יהיה זהה לכל מי שמשחק באותו יום
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const disjoint = (a, b) => a.start !== b.start && !overlaps(a, b);

/* המספר הגדול ביותר של פריטים זרים זה לזה שאפשר לבחור מהמאגר - בחירה
   חמדנית לפי סוף הטווח, שהיא האופטימלית לבעיה הזו. תקופה אחת צרה עם
   תחום אחד (למשל האבות בלבד: כולם חיו בחפיפה) לא מספיקה ליד, וזה מה
   שמאפשר לומר לגולש מראש במקום שהמשחק ייתקע. */
function maxDisjoint(pool) {
  const out = [];
  for (const it of [...pool].sort((x, y) => x.end - y.end || x.start - y.start)) {
    if (out.every((h) => disjoint(h, it))) out.push(it);
  }
  return out;
}

/* פריט שייך לכל תקופה שהיה בה, לא רק לזו שבה התחיל: משה נולד בגלות מצרים
   אבל הוא דמות של דור המדבר, ומי שבוחר "דור המדבר" מצפה למצוא אותו שם */
export function inPeriod(it, p) {
  if (it.start === it.end) return it.start >= p.start && it.start < p.end;
  return it.start < p.end && it.end > p.start;
}

const kindsOf = (topics) => new Set(TOPICS.filter((t) => topics.includes(t.id)).flatMap((t) => t.kinds));

/* סינון הדדי בלוח הבחירה: מה שנבחר ראשון מצמצם את השני. תחום זמין רק אם
   יש לו פריט באחת התקופות שנבחרו, ותקופה זמינה רק אם יש בה פריט מהתחומים
   שנבחרו. כשהצד השני ריק - הכל זמין. */
export function availableTopics(periods) {
  if (!periods.length) return TOPICS.map((t) => t.id);
  const ranges = periods.map((i) => SORTED_PERIODS[i]);
  return TOPICS.filter((t) => CANDIDATES.some((it) => t.kinds.includes(it.kind)
    && ranges.some((p) => inPeriod(it, p)))).map((t) => t.id);
}
export function availablePeriods(topics) {
  if (!topics.length) return SORTED_PERIODS.map((_, i) => i);
  const kinds = kindsOf(topics);
  return SORTED_PERIODS.map((p, i) => i).filter((i) => CANDIDATES.some((it) => kinds.has(it.kind)
    && inPeriod(it, SORTED_PERIODS[i])));
}

/* המאגר לפי בחירת הגולש: תחומים, ותקופות (אינדקסים ב-PERIODS, לא חייבות
   להיות רצופות).
   קודם רק המוכרים; אם הם לא מספיקים ליד, נכנסים גם הפחות מוכרים מאותם
   תחומים - מי שבחר "מלכים" בתקופת הפילוג ביקש את זה במפורש.
   מחזיר null כשגם כך אין מספיק. */
export function poolFor(topics, periods) {
  const kinds = kindsOf(topics);
  const ranges = periods.map((i) => SORTED_PERIODS[i]);
  const inRange = CANDIDATES.filter((it) => kinds.has(it.kind) && ranges.some((p) => inPeriod(it, p)));
  const known = inRange.filter(familiar);
  if (maxDisjoint(known).length >= HAND) return known;
  if (maxDisjoint(inRange).length >= HAND) return inRange;
  return null;
}

function shuffle(arr, random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ערבוב, ואז מעבר חמדני: כל פריט שאינו חופף לאף אחד מהנבחרים נכנס.
   כשיש אירועים במאגר - לפחות אירוע אחד ביד: דמויות בלבד הן חידון שמות,
   ואירוע נותן עוגן שכל אחד מכיר. במאגר צפוף הערבוב עלול לא למצוא יד,
   ואז בוחרים חמישה מתוך הקבוצה הזרה הגדולה, שקיומה כבר הובטח. */
export function deal(random, pool = POOL) {
  const wantEvent = pool.some((it) => it.kind === 'event');
  for (let tries = 0; tries < 200; tries++) {
    const hand = [];
    for (const it of shuffle(pool, random)) {
      if (hand.every((h) => disjoint(h, it))) hand.push(it);
      if (hand.length === HAND) break;
    }
    if (hand.length === HAND && (!wantEvent || hand.some((h) => h.kind === 'event'))) return hand;
  }
  const safe = maxDisjoint(pool);
  if (safe.length < HAND) throw new Error('deal: לא נמצאה יד תקינה');
  return shuffle(safe, random).slice(0, HAND);
}

// היום לפי שעון ישראל - האתגר מתחלף בחצות כאן, לא ב-UTC
export function israelDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}

// מספר האתגר: 1 ביום ההשקה. מחושב מהתאריך, ולכן זהה בכל מכשיר.
// הספירה אופסה ל-5.10.2026 (במקום 28.9), יום הפרסום הרחב בסטטוס, יחד עם מחיקת
// נתוני המשחק עד אז. משנה רק את המספר: היד נגזרת מהתאריך (seedOf(day)) ולא ממנו
const EPOCH = Date.UTC(2026, 9, 5);
export function dayNumber(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) + 1;
}

export const byTime = (a, b) => a.start - b.start;
