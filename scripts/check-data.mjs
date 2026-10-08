/* בדיקת תוכן למסעות (maps.json) - רצה בתחילת npm run build, ולכן גם ב-Vercel:
   נתון שבור עוצר את הבנייה ולא מגיע לאתר.

   שער האיכות (smoke.mjs) בודק שהמסכים נטענים, לא שהתוכן הגיוני. באוקטובר 2026
   גולש העיר שבמסע של יורם "מקום המוות שלו הוא שני מתוך שלוש" - המסע למואב
   (מלכים ב' ג) הופיע אחרי מותו ביזרעאל (ט). בסריקה נמצאו עוד שניים (פקח,
   עוזיהו). השורש: התחנות נכתבו לפי מקום - הבירה ראשונה, ואירועים מזמנים שונים
   באותה עיר נדחסו לתחנה אחת - ולא לפי זמן.

   מה נבדק:
   1. order בכל מסע הוא 1..n, בלי כפילות ובלי חור.
   2. תחנה שמתארת את מות בעל המסע או את קבורתו היא האחרונה.

   הזיהוי לפי מילים שלמות בכותרת התחנה (label), ובכוונה צר:
   - "מותו", "מותה", "קבורתו", "וקבורתו", "הקבורה" - כן.
   - "מות סיסרא", "קבורת רחל" (סמיכות) - לא: זה מותו של מישהו אחר, ומותר באמצע
     (רחל נקברת באמצע המסע של יעקב).
   - "לפני מותו" - לא: יהושע מחדש את הברית לפני מותו, ותחנת קבורתו אחריה.
   - "החומות" - לא: בדיקה לפי מחרוזת ולא לפי מילה סימנה את חומות עוזיהו. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const maps = JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/maps.json', import.meta.url)), 'utf8'));

const DEATH = new Set(['מותו', 'מותה', 'מותם', 'מיתתו', 'קבורתו', 'קבורתה', 'קבורה', 'הקבורה',
  'נהרג', 'נהרגה', 'נקבר', 'נקברה', 'הומת', 'הומתה', 'נרצח', 'עצמותיו']);

function isDeath(label) {
  const words = String(label || '').split(/[^א-ת]+/).filter(Boolean);
  return words.some((w, i) => {
    const base = w.startsWith('ו') && DEATH.has(w.slice(1)) ? w.slice(1) : w;
    return DEATH.has(base) && words[i - 1] !== 'לפני';
  });
}

const errors = [];
let journeys = 0;
for (const [key, m] of Object.entries(maps)) {
  if (!Array.isArray(m.points)) continue;
  journeys++;
  const pts = [...m.points].sort((a, b) => a.order - b.order);
  const orders = pts.map((p) => p.order);
  if (orders.some((o, i) => o !== i + 1)) {
    errors.push(`${key} (${m.title}): order צריך להיות 1..${pts.length} בלי כפילות, ויש ${orders.join(',')}`);
  }
  pts.forEach((p, i) => {
    if (i < pts.length - 1 && isDeath(p.label)) {
      errors.push(`${key} (${m.title}): "${p.label}" ב${p.name} היא תחנה ${p.order} מתוך ${pts.length}, `
        + `ואחריה עוד "${pts[i + 1].label}". מוות או קבורה הם התחנה האחרונה - לבדוק את הסדר מול הכתוב.`);
    }
  });
}

if (errors.length) {
  console.error(`בדיקת המסעות נכשלה (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-data: ${journeys} מסעות תקינים`);
