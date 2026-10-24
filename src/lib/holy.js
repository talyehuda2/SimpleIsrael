/* שבת וחג: מתי מותר לשלוח התראה (api/push-daily.js, api/push.js, pushPrompt.js).

   בהחלטת בעל האתר (אוקטובר 2026): לעולם לא בשבת. בערב שבת - עד 15:00, ובמוצאי
   שבת - רק מ-21:00, שעון ישראל. אותו כלל לימים טובים, לפי לוח ארץ ישראל (יום
   אחד): ראש השנה (שני ימים), יום כיפור, סוכות, שמיני עצרת, פסח, שביעי של פסח,
   שבועות.

   הבדיקה כאן ולא רק בשעות ה-Cron: Cron יכול לרוץ באיחור, ומישהו יכול להפעיל
   את הכתובת ידנית. השעות הקבועות ב-vercel.json הן רק המועד; זו ההגנה.

   הלוח העברי מ-Intl (ICU) - אותו מקור של hebrew-months.mjs ושם החודש בטבלת
   המובילים. אין טבלת תאריכים שמתיישנת. */

const TZ = 'Asia/Jerusalem';
const YOM_TOV = { Tishri: [1, 2, 10, 15, 22], Nisan: [15, 21], Sivan: [6] };

const heb = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
});

/** האם התאריך (YYYY-MM-DD, ישראל) הוא שבת או יום טוב */
export function isHoly(day) {
  const d = new Date(`${day}T12:00:00Z`);
  if (d.getUTCDay() === 6) return true;
  const p = Object.fromEntries(heb.formatToParts(d).map((x) => [x.type, x.value]));
  return (YOM_TOV[p.month] || []).includes(Number(p.day));
}

const addDay = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** היום והשעה בישראל */
export function israelNow(now = new Date()) {
  const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** מותר לשלוח עכשיו? בשבת/חג - רק מ-21:00 (מוצאי); בערב שבת/חג - רק עד 15:00 */
export function sendAllowed(now = new Date()) {
  const { day, hour } = israelNow(now);
  if (isHoly(day) && hour < 21) return false;
  if (isHoly(addDay(day, 1)) && hour >= 15) return false;
  return true;
}

/* השעות שאפשר לבחור (supabase/push_time.sql, בעל האתר, אוקטובר 2026). לכל אחת שתי
   הפעלות Cron ב-vercel.json - ה-Cron הוא UTC בלי שעון קיץ - והשרת שולח רק בזו שבה
   השעה בישראל מתאימה. ברירת המחדל 21:00, כמו לפני שהייתה בחירה */
export const SLOTS = [8, 13, 17, 21];
export const DEFAULT_SLOT = 21;

/** עד איזו שעה לשלוח בהפעלה הזו (מי שבחר בה או קודם ועוד לא קיבל). null - אין שליחה.
    בערב שבת/חג ההפעלה של 13:00 היא האחרונה לפני הכניסה, ולכן שולחת לכולם (24); בשבת
    ובחג עצמם הכל נדחה למוצאי, ושם 21 ממילא כולל את כולם */
export function slotUpTo(now = new Date()) {
  if (!sendAllowed(now)) return null;
  const { day, hour } = israelNow(now);
  if (!SLOTS.includes(hour)) return null;
  const last = SLOTS.filter((h) => h < 15).pop();
  return isHoly(addDay(day, 1)) && hour === last ? 24 : hour;
}

/* התדירות שהגולש בחר, ואילו מהן "בתור" היום. כל יום - כל יום שבו יוצאת התראה;
   יום כן יום לא - לפי זוגיות מספר היום; פעמיים בשבוע - שלישי ושישי; פעם בשבוע -
   שישי בצהריים, לקראת שבת. */
export const FREQS = [
  ['daily', 'כל יום'],
  ['alt', 'יום כן יום לא'],
  ['twice', 'פעמיים בשבוע'],
  ['weekly', 'פעם בשבוע'],
];

export function freqsDue(day) {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = d.getUTCDay();
  const n = Math.round(d.getTime() / 864e5);
  const due = ['daily'];
  if (n % 2 === 0) due.push('alt');
  if (dow === 2 || dow === 5) due.push('twice');
  if (dow === 5) due.push('weekly');
  return due;
}
