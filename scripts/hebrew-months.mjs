/* מפיק את רשימת ראשי החודשים העבריים (יום א' של כל חודש) בטווח שנים, לשימוש
   ב-supabase/game_board_month.sql - ל-Postgres אין לוח עברי. הלוח מגיע מ-Intl
   (ICU), אותו לוח שהדפדפן משתמש בו להצגת שם החודש בטבלת המובילים.
   הרצה: node scripts/hebrew-months.mjs 2026-09-01 2047-01-01 */
const [from = '2026-09-01', to = '2047-01-01'] = process.argv.slice(2);
const day = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', timeZone: 'UTC' });
const out = [];
for (let t = Date.parse(from); t < Date.parse(to); t += 864e5) {
  if (day.format(new Date(t)) === '1') out.push(new Date(t).toISOString().slice(0, 10));
}
console.log(out.map((d) => `'${d}'`).join(', '));
console.error(`${out.length} ראשי חודשים, ${out[0]} עד ${out[out.length - 1]}`);
