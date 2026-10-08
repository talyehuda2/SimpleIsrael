/* בדיקת ציטוטים: כל ציטוט במירכאות בקובצי התוכן חייב להופיע בתנ"ך.

   באוקטובר 2026 נמצאו בסבב בדיקה ידני חמישה ציטוטים שגויים במסעות ("אין קהה
   לשברך" במקום "כהה", "זאת דבר המס" במקום "וזה", "ארדה עמך" במקום "אנכי ארד
   עמך"...). טעות כזאת לא נראית לעין של מי שלא זוכר את הפסוק, ולכן הבדיקה
   מכנית: נוסח התנ"ך המלא יושב ב-build-assets/tanakh.json.gz (כתר לנינגרד
   בעיבוד וסטמינסטר, דרך Sefaria-Export - נחלת הכלל), וכל ציטוט מחפשים בו.

   ההשוואה סלחנית בכתיב ולא במילים - כדי שהבדיקה תיפול על טעות ולא על סגנון:
   - ניקוד וטעמים יורדים; ה' = יהוה, אלוקים = אלהים (האתר כותב בכינוי).
   - ו' וי' יורדות לגמרי משני הצדדים: כתיב מלא וחסר ("אנוכי"/"אנכי") זהים.
   - "..." מפצל את הציטוט לקטעים, וכל קטע נבדק לבד. קטע של מילה אחת לא נבדק.
   מה שנשאר - מילה אחרת, אות אחרת שאינה ו' או י', סדר מילים - נכשל.

   ציטוט שאינו מן המקרא (חז"ל, מדרש, תפילה, תרגום) נרשם ב-scripts/quotes-allow.json
   עם הסבר קצר, וכך הוא מסומן במפורש ולא נבלע.

   הרצה: node scripts/check-quotes.mjs           - נכשל על ציטוט שלא נמצא
         node scripts/check-quotes.mjs --report  - מדפיס הכל ולא נכשל */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const REPORT = process.argv.includes('--report');

// קובצי התוכן. places.json מיוצר מ-maps.json ו-placeLore.json, ולכן לא נבדק פעמיים
const FILES = ['maps', 'placeLore', 'kings', 'leaders', 'judges', 'prophets', 'events', 'books',
  'collections', 'tours', 'world'].map((n) => `src/data/${n}.json`);

const tanakh = JSON.parse(gunzipSync(readFileSync(root('build-assets/tanakh.json.gz'))).toString('utf8')).books;

/* ---------- נרמול ---------- */
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export function skeleton(s) {
  return s
    .replace(/[֑-ׇ]/g, (c) => (c === '־' ? ' ' : ''))   // ניקוד וטעמים; מקף -> רווח
    .replace(/(^|[^א-ת])([ובלכמש]?)ה['׳](?![א-ת])/g, '$1$2יהוה')
    .replace(/אלוק/g, 'אלה')
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .replace(/[^א-ת]+/g, ' ')
    .replace(/[וי]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const books = Object.entries(tanakh).map(([name, chs]) => [name, ' ' + skeleton(chs.flat().join(' ')) + ' ']);

/* ---------- חילוץ ציטוטים ----------
   שלושה סוגי מירכאות בנתונים: '...' (בעיקר במסעות), "..." ו-״...״. אותם תווים
   משמשים גם כגרש וכגרשיים - ה', ג', תנ"ך, דה״ב - ולכן: מירכאה פותחת באה אחרי
   רווח או תחילת שורה ולפני אות; סוגרת באה אחרי אות או פיסוק ולא לפני אות; וגרש
   אחרי אות בודדת (ה', ב', וה', לה') אינו סוגר. */
const QUOTES = ["'", '"', '״'];
const isLetter = (c) => c >= 'א' && c <= 'ת' || (c >= '֑' && c <= 'ׇ');
function extract(str) {
  const found = [];
  for (const q of QUOTES) {
    let i = 0;
    while ((i = str.indexOf(q, i)) !== -1) {
      const prev = str[i - 1];
      if (!(i === 0 || /[\s(\-–—:,]/.test(prev)) || !isLetter(str[i + 1] || '')) { i++; continue; }
      let j = i + 1;
      let close = -1;
      while ((j = str.indexOf(q, j)) !== -1) {
        const after = str[j + 1] || '';
        if (isLetter(after)) { j++; continue; }                 // גרשיים בתוך מילה
        const word = str.slice(0, j).match(/[א-ת֑-ׇ]+$/)?.[0]?.replace(/[֑-ׇ]/g, '') || '';
        if (q === "'" && (word.length === 1 || /^[ובלכמש]?ה$/.test(word))) { j++; continue; } // ה', ב'
        close = j; break;
      }
      if (close === -1) { i++; continue; }
      found.push(str.slice(i + 1, close));
      i = close + 1;
    }
  }
  return found;
}

function* strings(node, path) {
  if (typeof node === 'string') yield [path, node];
  else if (Array.isArray(node)) for (let k = 0; k < node.length; k++) yield* strings(node[k], `${path}[${k}]`);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* strings(v, path ? `${path}.${k}` : k);
}

/* קטע נמצא אם הוא מופיע כמילים שלמות - או שהמילה הראשונה שלו מופיעה בפסוק עם אות
   שימוש לפניה ("מיטב הארץ" מתוך "במיטב הארץ"): ציטוט נוהג להשמיט את ב', ל', ה'... */
const found = (t, p) => t.includes(` ${p} `) || [...'בהכלמש'].some((c) => t.includes(` ${c}${p} `));

/* ---------- בדיקה ---------- */
const allow = JSON.parse(readFileSync(root('scripts/quotes-allow.json'), 'utf8'));
const allowed = new Set(allow.map((a) => skeleton(a.text)));

let checked = 0;
const misses = [];
for (const file of FILES) {
  const data = JSON.parse(readFileSync(root(file), 'utf8'));
  for (const [path, s] of strings(data, '')) {
    // שדה verse הוא פסוק בלי מירכאות - כולו ציטוט. בלי זה עברו "ייתן נא פי שניים
    // ברוחך לי" ו"ועשה ה' לאדוני" (באוקטובר 2026), כי הבדיקה חיפשה רק מירכאות
    const quotes = /\.verse$|^verse$/.test(path) ? [/^(["״]).*\1$/.test(s) ? s.slice(1, -1) : s, ...extract(s)] : extract(s);
    for (const quote of quotes) {
      const parts = quote.split(/\.{3}|…/).map(skeleton).filter((p) => p.split(' ').length >= 2);
      if (!parts.length) continue;
      checked++;
      if (allowed.has(skeleton(quote))) continue;
      const missing = parts.filter((p) => !books.some(([, t]) => found(t, p)));
      if (missing.length) misses.push({ file, path, quote, missing });
    }
  }
}

if (REPORT) for (const m of misses) console.log(`${m.file} ${m.path}\n   ${m.quote}\n   ✗ ${m.missing.join(' | ')}`);
if (misses.length && !REPORT) {
  console.error(`בדיקת הציטוטים נכשלה: ${misses.length} ציטוטים לא נמצאו בתנ"ך.\n`
    + misses.map((m) => `- ${m.file} (${m.path}): "${m.quote}"`).join('\n')
    + '\n\nלתקן את הציטוט לפי הפסוק, או - אם אינו מן המקרא - להוסיף אותו ל-scripts/quotes-allow.json עם הסבר.');
  process.exit(1);
}
console.log(`check-quotes: ${checked} ציטוטים, ${misses.length} לא נמצאו`);
