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
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const maps = JSON.parse(readFileSync(root('src/data/maps.json'), 'utf8'));
const tanakh = JSON.parse(gunzipSync(readFileSync(root('build-assets/tanakh.json.gz'))).toString('utf8')).books;

/* ---------- מראי מקום (ref) ----------
   לכל תחנה מראה מקום: "מלכים ב יז, ד-ו", "בראשית כב", "שמואל א ל" - או "מסורת: <מקור>"
   לתחנה שאין לה פסוק. הבדיקה: הספר, הפרק והפסוק קיימים בנוסח (build-assets/tanakh.json.gz),
   ותחנות שמקורן באותו רצף סיפורי באות בסדר עולה. רצף = ספרים שהסיפור עובר ביניהם ברצף
   (שמואל א עד מלכים ב, למשל). ספרי נבואה, דניאל ותהילים אינם כרונולוגיים - לא נבדקים לסדר.
   תחנה שסדרה נכון אף שהפסוק שלה מוקדם (מלכים מספר את ישראל ויהודה בגושים נפרדים) נושאת
   "refOrder" עם ההסבר, ואינה משתתפת בהשוואה. */
const SEQUENCES = [
  ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים'],
  ['יהושע'], ['שופטים'], ['רות'],
  ['שמואל א', 'שמואל ב', 'מלכים א', 'מלכים ב'],
  ['דברי הימים א', 'דברי הימים ב'],
  ['עזרא', 'נחמיה'], ['אסתר'], ['יונה'],
];
const GEM = Object.fromEntries([...'אבגדהוזחטיכלמנסעפצקרשת'].map((c, i) => [c, i < 10 ? i + 1 : i < 19 ? (i - 8) * 10 : (i - 17) * 100]));
const num = (s) => [...s].reduce((n, c) => n + (GEM[c] ?? NaN), 0);
export function parseRef(ref) {
  const m = String(ref).match(/^(.+?) ([א-ת]+)(?:-([א-ת]+))?(?:, ([א-ת]+)(?:-([א-ת]+))?)?$/);
  if (!m || !tanakh[m[1]]) return null;
  const [, book, c1, c2, v1, v2] = m;
  const r = { book, chapter: num(c1), toChapter: c2 ? num(c2) : num(c1), verse: v1 ? num(v1) : 1, toVerse: v2 ? num(v2) : null };
  const chs = tanakh[book];
  if (!(r.chapter >= 1 && r.toChapter >= r.chapter && r.toChapter <= chs.length)) return null;
  if (r.verse > chs[r.chapter - 1].length || (r.toVerse && (r.toVerse < r.verse || r.toVerse > chs[r.chapter - 1].length))) return null;
  return r;
}
const seqOf = (book) => SEQUENCES.findIndex((s) => s.includes(book));
const posOf = (r) => SEQUENCES[seqOf(r.book)].indexOf(r.book) * 1e6 + r.chapter * 1000 + r.verse;

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
let refs = 0;
for (const [key, m] of Object.entries(maps)) {
  if (!Array.isArray(m.points)) continue;
  journeys++;
  const pts = [...m.points].sort((a, b) => a.order - b.order);
  const orders = pts.map((p) => p.order);
  if (orders.some((o, i) => o !== i + 1)) {
    errors.push(`${key} (${m.title}): order צריך להיות 1..${pts.length} בלי כפילות, ויש ${orders.join(',')}`);
  }
  const last = {};   // רצף -> התחנה האחרונה שנבדקה בו
  for (const p of pts) {
    if (!p.ref) { errors.push(`${key}: לתחנה ${p.order} (${p.name}) אין ref - מראה מקום או "מסורת: <מקור>"`); continue; }
    refs++;
    if (p.ref.startsWith('מסורת:')) continue;
    const r = parseRef(p.ref);
    if (!r) { errors.push(`${key}: ref לא תקין או לא קיים בתנ"ך בתחנה ${p.order} (${p.name}): "${p.ref}"`); continue; }
    const seq = seqOf(r.book);
    if (seq < 0 || p.refOrder) continue;
    const prev = last[seq];
    if (prev && posOf(r) < posOf(prev.r)) {
      errors.push(`${key} (${m.title}): תחנה ${p.order} (${p.name}, ${p.ref}) באה אחרי תחנה ${prev.p.order} `
        + `(${prev.p.name}, ${prev.p.ref}), אבל הפסוק שלה מוקדם יותר. לבדוק את הסדר - ואם הוא נכון, refOrder עם הסבר.`);
    }
    last[seq] = { p, r };
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
console.log(`check-data: ${journeys} מסעות תקינים, ${refs} מראי מקום`);
