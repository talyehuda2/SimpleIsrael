/* "דמות היום" - פריט אחד ליום, זהה לכולם, להתראה היומית (api/push-daily.js).

   הסדר: הדמויות והאירועים מסודרים פעם אחת בזרע קבוע, ויום N מקבל את הפריט
   ה-N בסבב, בלי חזרה עד שהסבב (כ-120 ימים) נגמר. ספרים, אימפריות ושליטים זרים
   לא נכנסים: "דמות היום" היא מישהו מתולדות ישראל, או אירוע.

   שני כללים בסידור (אוקטובר 2026): מוכר ופחות מוכר לסירוגין, ולא שני פריטים
   רצופים מאותה תקופה. ערבוב אקראי לבדו פתח את הסבב ביהויכין, יואש, אמון
   ויהואחז - ובשבועות הראשונים נקבע אם מי שנרשם נשאר. "מוכר" הוא אותו מאגר של
   האתגר היומי במשחק (familiar ב-pool.js): כל האבות, המלכים המאוחדים והאירועים,
   ושופטים, מלכים ונביאים ידועים.

   מוסיפים פריט לנתונים = הסבב משתנה מאותו יום. זה בסדר - אין התחייבות
   לסדר מסוים, רק לכך שכולם מקבלים אותו פריט באותו יום. */
import { ALL_ITEMS, SORTED_PERIODS } from '../data/items.js';
import { rng, israelDay, familiar, inPeriod } from '../game/pool.js';

const KINDS = ['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'event'];
const START = Date.UTC(2026, 9, 18);   // יום 0 של הסבב

const eraOf = (it) => SORTED_PERIODS.findIndex((p) => inPeriod(it, p));

function shuffle(list, r) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

let order = null;
function cycle() {
  if (order) return order;
  const all = ALL_ITEMS.filter((x) => KINDS.includes(x.kind) && x.description)
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const r = rng(0x5ea1);
  const known = shuffle(all.filter(familiar), r);
  const rest = shuffle(all.filter((x) => !familiar(x)), r);
  /* לסירוגין, ביחס הגדלים: בכל צעד הרשימה שהתקדמה פחות (מוכרים בתיקו). מוכרים
     יש יותר, ולכן מדי כמה ימים שניים ברצף - ולא כולם נערמים בסוף הסבב. ומכל
     רשימה - הראשון שאינו מהתקופה של הקודם */
  const n = { known: known.length, rest: rest.length };
  order = [];
  while (known.length || rest.length) {
    const k = 1 - known.length / n.known, u = 1 - rest.length / n.rest;
    const from = !rest.length || (known.length && k <= u) ? known : rest;
    const prev = order.length ? eraOf(order[order.length - 1]) : null;
    const i = Math.max(0, from.findIndex((x) => eraOf(x) !== prev));
    order.push(from.splice(i, 1)[0]);
  }
  return order;
}

/** הפריט של יום מסוים בשעון ישראל ('2026-10-18'), או של היום */
export function dailyItem(day = israelDay()) {
  const list = cycle();
  const n = Math.round((Date.parse(`${day}T00:00:00Z`) - START) / 864e5);
  return list[((n % list.length) + list.length) % list.length];
}

/* גוף ההתראה: משפטים שלמים מתחילת התיאור, עד ~130 תווים. משפט פתיחה קצר
   ("בן יהואחז, מלך שש עשרה שנה.") לא אומר כלום לבד, ולכן מצטרף אליו הבא.
   התראה ארוכה נחתכת ממילא בטלפון, ומשפט שלם קורא טוב יותר משבר משפט. */
export function teaser(text, max = 130) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const sentences = s.match(/[^.!?]+[.!?]+(?=\s|$)/g) || [s];
  let out = '';
  for (const x of sentences) {
    const next = (out ? `${out} ` : '') + x.trim();
    if (out && next.length > max) break;
    out = next;
    if (out.length >= 70) break;
  }
  if (out.length <= max + 20) return out;
  const cut = out.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 60))}…`;
}

export const dailyLabel = (it) => (it.kind === 'event' ? 'אירוע היום' : 'דמות היום');
