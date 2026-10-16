/* "דמות היום" - פריט אחד ליום, זהה לכולם, להתראה היומית (api/push-daily.js).

   הסדר: כל הדמויות והאירועים מעורבבים פעם אחת בזרע קבוע, ויום N מקבל את
   הפריט ה-N בסבב. כך אין חזרה עד שהסבב (כ-120 ימים) נגמר, ושני ימים רצופים
   לא נופלים במקרה על אותה תקופה. ספרים, אימפריות ושליטים זרים לא נכנסים:
   "דמות היום" היא מישהו מתולדות ישראל, או אירוע.

   מוסיפים פריט לנתונים = הסבב משתנה מאותו יום. זה בסדר - אין התחייבות
   לסדר מסוים, רק לכך שכולם מקבלים אותו פריט באותו יום. */
import { ALL_ITEMS } from '../data/items.js';
import { rng, israelDay } from '../game/pool.js';

const KINDS = ['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'event'];
const START = Date.UTC(2026, 9, 18);   // יום 0 של הסבב

let order = null;
function cycle() {
  if (order) return order;
  order = ALL_ITEMS.filter((x) => KINDS.includes(x.kind) && x.description)
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  const r = rng(0x5ea1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
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
