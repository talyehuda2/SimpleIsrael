/* מפיק את טבלת פרשות השבוע (לוח ארץ ישראל) לפי תאריך השבת, לשימוש
   ב-src/lib/daily.js: ההתראה של יום שישי היא דמות או אירוע מהפרשה של מחר.
   הטבלה נשמרת בקובץ ולא מחושבת בזמן ריצה, כמו hebrew-months.mjs: החישוב
   (פרשות מחוברות, שבת שחלה בחג) מסובך מכדי לכתוב בעצמנו, ו-@hebcal/core
   נדרש רק כאן - לא בשרת ולא בדפדפן. שבת שהיא חג או חול המועד לא נכנסת.
   הרצה: node scripts/parashot.mjs [מ-] [עד] > src/lib/parashot.json */
import { Sedra, HDate } from '@hebcal/core';

const [from = '2026-09-01', to = '2047-01-01'] = process.argv.slice(2);
const sedra = new Map();
const out = {};
for (let t = Date.parse(from); t < Date.parse(to); t += 864e5) {
  const d = new Date(t);
  if (d.getUTCDay() !== 6) continue;
  const h = new HDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (!sedra.has(h.getFullYear())) sedra.set(h.getFullYear(), new Sedra(h.getFullYear(), true));
  const r = sedra.get(h.getFullYear()).lookup(h);
  if (!r.chag) out[d.toISOString().slice(0, 10)] = r.parsha.join('-');
}
console.log(JSON.stringify(out));
const n = Object.keys(out);
console.error(`${n.length} שבתות, ${n[0]} עד ${n[n.length - 1]}`);
