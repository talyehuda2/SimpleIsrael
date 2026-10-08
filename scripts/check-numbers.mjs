/* בדיקת מספרים: שנים, משכים וגילים שסותרים זה את זה בתוך הנתונים.

   check-data בודק סדר במסעות, ו-check-quotes בודק ציטוטים - אבל בסבב הקריאה של
   אוקטובר 2026 רוב הטעויות היו מספרים: "ארבעה דורות" לבית עמרי, "שנתיים וחצי"
   למצור, חנוכה שנכתבה לפי התאריך המחקרי. חלק מהן אפשר לתפוס מכנית, כי אותו
   מספר כתוב באתר פעמיים - פעם כשדה (start/end/year) ופעם בטקסט:

   1. משך: reignText / lifeText / tenureText ("17 שנה") מול end - start.
      במלכים - סובלנות של שנה: הכתוב סופר שנה חלקית כשנה, ושנת המעבר נספרת
      לשני המלכים. בחיים ובשפיטה - בדיוק. הסבר בסוגריים ("חלקן במקביל לעוזיהו")
      פוטר, כי הוא אומר לגולש למה המספרים אינם מסתכמים.
   2. סנכרון: "בשנה החמישית לרחבעם", "בשנת תשע להושע", "בשנה הרביעית למלכותו" -
      השנה המחושבת (תחילת המלך + N - 1) חייבת ליפול בתוך שנות הפריט שבתיאורו
      היא כתובה, ו-N לא יכול לעלות על משך המלוכה.
   3. גיל: "מת בן מאה ועשר" / "במותו בן..." בתיאור של דמות = end - start שלה.
      "בגיל N" בתיאור של דמות - לא יותר משנות חייה. "בגיל N" בתיאור של אירוע -
      אחת הדמויות שבו נולדה N שנים לפני האירוע (לך לך: אברהם, 1948 + 75 = 2023).
   4. נביאים: כל מלך בשדה kings ("עוזיהו, יותם, אחז, חזקיהו") חופף לשנות הנביא.
   5. שנה מפורשת בטקסט ("בשנת 3327") - שנה של פריט כלשהו, ולא המרה ממקור אחר.
   6. תקופות: רצופות, בלי חור ובלי חפיפה.

   השנים הן לבריאה לפי סדר עולם, כמו בכל האתר. ממצא שאינו טעות (מסורת חלוקה,
   ספירה אחרת) נרשם ב-scripts/numbers-allow.json עם הסבר, וכך הוא מסומן במפורש.

   הרצה: node scripts/check-numbers.mjs           - נכשל על כל ממצא
         node scripts/check-numbers.mjs --report  - מדפיס ולא נכשל */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const load = (n) => JSON.parse(readFileSync(root(`src/data/${n}.json`), 'utf8'));
const REPORT = process.argv.includes('--report');

const kings = load('kings');
const ITEMS = [
  ...load('leaders').map((x) => ({ ...x, kind: 'leader' })),
  ...load('judges').map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...load('prophets').map((x) => ({ ...x, kind: 'prophet' })),
  ...load('books').map((x) => ({ ...x, kind: 'book' })),
  ...load('world').map((x) => ({ ...x, kind: 'world' })),
  ...load('events').map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
];
const KINGS = ITEMS.filter((x) => ['united', 'judah', 'israel'].includes(x.kind));
const PEOPLE = ITEMS.filter((x) => ['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'world'].includes(x.kind));
const periods = load('periods').slice().sort((a, b) => a.start - b.start);

/* ---------- מספרים בעברית ---------- */
const UNITS = { 'אחת': 1, 'אחד': 1, 'שתיים': 2, 'שתים': 2, 'שניים': 2, 'שנים': 2, 'שתי': 2, 'שני': 2, 'שלוש': 3, 'שלושה': 3,
  'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5, 'שש': 6, 'שישה': 6, 'שבע': 7, 'שבעה': 7, 'שמונה': 8,
  'תשע': 9, 'תשעה': 9, 'עשר': 10, 'עשרה': 10 };
const TENS = { 'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50, 'שישים': 60, 'שבעים': 70, 'שמונים': 80, 'תשעים': 90 };
const HUNDREDS = { 'מאה': 100, 'מאתיים': 200 };
const ORD = { 'הראשונה': 1, 'השנייה': 2, 'השנית': 2, 'השלישית': 3, 'הרביעית': 4, 'החמישית': 5, 'השישית': 6, 'השביעית': 7,
  'השמינית': 8, 'התשיעית': 9, 'העשירית': 10 };
/* מילה עם ו' החיבור ("ועשר") או ה' הידיעה ("העשרים") - בסיס המילה */
const bare = (w) => (/^[וה]/.test(w) && !(w in UNITS) && !(w in TENS) && !(w in HUNDREDS) && !(w in ORD) ? w.slice(1) : w);
/* קורא מספר מתחילת רצף מילים; מחזיר {n, len} או null. "מאה שבעים וחמש", "ארבע עשרה",
   "החמישית", "העשרים וחמש", "17" */
export function readNumber(words) {
  if (/^\d+$/.test(words[0])) return { n: +words[0], len: 1 };
  if (words[0] in ORD) return { n: ORD[words[0]], len: 1 };
  let n = 0, i = 0, any = false;
  for (; i < words.length; i++) {
    const w = bare(words[i]);
    if (w in HUNDREDS) n += HUNDREDS[w];
    else if (w in TENS) n += TENS[w];
    else if (w === 'עשרה' || (w === 'עשר' && any && n % 10)) n += 10;   // ארבע עשרה
    else if (w in UNITS) n += UNITS[w];
    else break;
    any = true;
  }
  return any ? { n, len: i } : null;
}
const words = (s) => String(s).replace(/[״"'׳]/g, '').split(/[^א-ת0-9]+/).filter(Boolean);

/* ---------- 1. משך ---------- */
const findings = [];
const seen = { 'משך': 0, 'סנכרון': 0, 'גיל': 0, 'נביא': 0, 'שנה': 0 };   // כמה טענות נבדקו - בדיקה שלא קוראת כלום עוברת בשקט
const add = (it, kind, msg) => findings.push({ key: `${it.kind}:${it.id}`, kind, msg: `${it.name}: ${msg}` });

for (const it of ITEMS) {
  const text = it.reignText || it.lifeText || it.tenureText;
  if (!text) continue;
  const w = words(text);
  let years = null;
  if (w[0] === 'שנתיים') years = 2;
  else if (/^שנה אחת/.test(text)) years = 1;
  else if (/^(\d+ )?(חודש|חודשים|ימים)/.test(text) || /^\d+ (חודשים|ימים)/.test(text)) years = 0;
  else {
    const r = readNumber(w);
    if (r && /^(שנה|שנים)$/.test(w[r.len] || '')) years = r.n;
  }
  if (years == null) continue;   // "אחת מארבע האמהות", "זמן קצר"
  seen['משך']++;
  const span = it.end - it.start;
  const tol = it.reignText ? 1 : 0;
  if (Math.abs(span - years) > tol && !/\(/.test(text)) {
    add(it, 'משך', `כתוב "${text}", ובנתונים ${it.start}-${it.end} = ${span} שנים`);
  }
  // "ומלך חמישים ושתיים שנה" בתיאור - אותו מספר כמו בשורת המשך
  const dw = words(it.description || '');
  dw.forEach((x, i) => {
    if (x !== 'מלך' && x !== 'ומלך') return;
    const r = readNumber(dw.slice(i + 1, i + 6));
    if (!r || !/^(שנה|שנים)$/.test(dw[i + 1 + r.len] || '')) return;
    seen['משך']++;
    if (r.n !== years) add(it, 'משך', `בתיאור "${dw.slice(i, i + 2 + r.len).join(' ')}", ובשורת המשך "${text}"`);
  });
}

/* ---------- 2. סנכרון: "בשנה החמישית לרחבעם" ----------
   השליט: "לרחבעם" / "למלכות כורש" - לפי שם; "למלכותו" - הפריט עצמו (מלך או שליט
   זר), ובאירוע - אחד המלכים שנזכרים בו; "בשנה החמישית עלה שישק" בתיאור של מלך -
   המלך עצמו. ארתחשסתא הוא דריווש לפי סדר עולם (ראש השנה ג ע"ב), כמו באתר. */
const RULERS = [...KINGS, ...ITEMS.filter((x) => x.kind === 'world')];
const RULER_ALIAS = { 'ארתחשסתא': 'דריווש', 'נבוכדנאצר': 'נבוכדנצר', 'חזקיה': 'חזקיהו' };
const byName = (name) => RULERS.filter((k) => k.name.replace(/ .*/, '') === (RULER_ALIAS[name] || name));
const named = (d, k) => { const n = k.name.replace(/ .*/, ''); return d.includes(n) || Object.entries(RULER_ALIAS).some(([a, b]) => b === n && d.includes(a)); };
for (const it of ITEMS) {
  const d = it.description || '';
  const w = words(d);
  for (let i = 0; i < w.length; i++) {
    if (w[i] !== 'בשנה' && w[i] !== 'בשנת') continue;
    const r = readNumber(w.slice(i + 1, i + 6));
    if (!r) continue;
    const next = w[i + 1 + r.len] || '';
    const target = next.startsWith('ל') ? next.slice(1) : '';
    let cands;
    if (!target) cands = KINGS.includes(it) ? [it] : [];      // "בשנה החמישית עלה" - בתיאור של מלך
    else if (target === 'מלכותו') {
      cands = RULERS.includes(it) ? [it] : it.kind === 'event' ? RULERS.filter((k) => named(d, k)) : [];
    } else if (target === 'מלכות') cands = byName(w[i + 2 + r.len] || '');
    else cands = byName(target);
    const m = [w.slice(i, i + 2 + r.len + (target === 'מלכות' ? 1 : 0) - (target ? 0 : 1)).join(' ')];
    if (!cands.length) continue;
    seen['סנכרון']++;
    const said = m[0];
    const fits = (k) => r.n <= k.end - k.start + 1 && Math.abs(k.start + r.n - 1 - (it.kind === 'event' ? it.year : k.start + r.n - 1)) <= 1
      && k.start + r.n - 1 >= it.start - 1 && k.start + r.n - 1 <= it.end + 1;
    if (!cands.some(fits)) {
      add(it, 'סנכרון', `"${said}" = ${cands.map((k) => `${k.name.replace(/ .*/, '')} ${k.start}+${r.n - 1} = ${k.start + r.n - 1}`).join(' / ')}`
        + `, אבל הפריט ב-${it.start === it.end ? it.start : `${it.start}-${it.end}`}`
        + (cands.some((k) => r.n > k.end - k.start + 1) ? ` (ו${cands[0].name.replace(/ .*/, '')} מלך ${cands[0].end - cands[0].start} שנים)` : ''));
    }
  }
}

/* ---------- 3. גיל ---------- */
const lifespans = new Set(PEOPLE.map((p) => p.end - p.start));
/* שם הדמות כפי שהוא כתוב בטקסט לפני שהשתנה */
const ALIAS = { avraham: ['אברם'], sarah: ['שרי'] };
const mentions = (d, p) => [p.name.replace(/ .*/, ''), ...(ALIAS[p.id] || [])].some((n) => d.includes(n));
for (const it of ITEMS) {
  const d = it.description || '';
  /* אצל האבות והמנהיגים start-end הם שנות החיים; אצל שופטים, נביאים ומלכים - שנות
     השפיטה, הנבואה או המלוכה (עלי שפט 40 שנה ומת בן 98). שם הגיל רק חוסם מלמטה */
  const life = it.kind === 'leader';
  const isPerson = ['leader', 'judge', 'prophet'].includes(it.kind);
  const span = it.end - it.start;
  // מות בגיל: רק בתיאור של הדמות עצמה. גיל שהוא משך החיים של דמות אחרת - כנראה עליה
  for (const m of d.matchAll(/(?:במותו|במותה|מת|מתה|נפטר|נפטרה) (?:ב[א-ת]+ )?בן ([א-ת ]+)/g)) {
    const r = readNumber(words(m[1]));
    if (!r || !isPerson) continue;
    seen['גיל']++;
    const said = `"${m[0].split(' ').slice(0, 3 + r.len).join(' ')}"`;
    if (life ? r.n !== span && !lifespans.has(r.n) : r.n < span) {
      add(it, 'גיל', `${said} - ובנתונים ${it.start}-${it.end} = ${span} שנים`);
    }
  }
  for (const m of d.matchAll(/בגיל ([א-ת ]+)/g)) {
    const r = readNumber(words(m[1]));
    if (!r) continue;
    seen['גיל']++;
    if (it.kind === 'event') {
      // לפחות דמות אחת שנזכרת באירוע נולדה N שנים לפניו (סובלנות שנה)
      const named = PEOPLE.filter((p) => mentions(d, p));
      if (named.length && !named.some((p) => Math.abs(p.start + r.n - it.year) <= 1)) {
        add(it, 'גיל', `"בגיל ${words(m[1]).slice(0, r.len).join(' ')}" בשנת ${it.year} - אף דמות שנזכרת (${named.map((p) => `${p.name} ${p.start}`).join(', ')}) לא הייתה אז בת ${r.n}`);
      }
    } else if (life && r.n > span && !lifespans.has(r.n)) {
      add(it, 'גיל', `"בגיל ${words(m[1]).slice(0, r.len).join(' ')}" - יותר משנות חייו בנתונים (${it.start}-${it.end})`);
    }
  }
}

/* ---------- 4. נביאים ומלכים ---------- */
const OTHER = /התקופה|תקופת|גלות|שיבת|לפי|יש |אם |הכהן|ואחרי/;
for (const p of ITEMS.filter((x) => x.kind === 'prophet' && x.kings)) {
  const names = p.kings.replace(/\(.*?\)/g, '').split(/[,;]| עד /).map((s) => s.trim().replace(/^מ(?=[א-ת]{3})/, '')).filter(Boolean);
  for (const name of names) {
    if (OTHER.test(name)) continue;
    const cands = byName(name);
    seen['נביא']++;
    if (!cands.length) continue;   // עלי, נבוכדנאצר - אינם פריטי מלך
    if (!cands.some((k) => k.start <= p.end && k.end >= p.start)) {
      add(p, 'נביא', `ניבא בימי ${name}, אבל ${cands.map((k) => `${k.name} ${k.start}-${k.end}`).join(' / ')} לא חופף ל-${p.start}-${p.end}`);
    }
  }
}

/* ---------- 5. שנה מפורשת בטקסט: "בשנת 3327", "(1948)" ----------
   חייבת להיות שנה של פריט כלשהו - אחרת היא כנראה המרה ממקור אחר (כמו חנוכה ב-3597,
   שהייתה 164 לפנה"ס מומרת) או שנה שהפריט שלה זז ושכחו לעדכן אותה כאן */
const KNOWN = new Set([...ITEMS.flatMap((x) => [x.start, x.end]), ...load('periods').flatMap((x) => [x.start, x.end])]);
for (const it of ITEMS) {
  for (const m of (it.description || '').matchAll(/(?:בשנת |\()(1[89]\d\d|[23]\d{3})(?![\d.,])/g)) {
    seen['שנה']++;
    if (!KNOWN.has(+m[1])) add(it, 'שנה', `"${m[0].replace('(', '')}" - אין פריט או תקופה בשנה הזאת`);
  }
}

/* ---------- 6. תקופות ---------- */
for (let i = 1; i < periods.length; i++) {
  const a = periods[i - 1], b = periods[i];
  if (a.end !== b.start) findings.push({ key: `period:${b.id}`, kind: 'תקופה', msg: `${a.name} נגמרת ב-${a.end} ו-${b.name} מתחילה ב-${b.start}` });
}

/* ---------- סיכום ---------- */
const allow = JSON.parse(readFileSync(root('scripts/numbers-allow.json'), 'utf8'));
/* היתר הוא לממצא מסוים (key + kind + מחרוזת מתוך ההודעה), לא לכל הפריט - כדי
   שטעות חדשה באותו פריט לא תעבור בשקט. היתר שכבר לא תואם דבר - נכשל גם הוא */
const isAllowed = (f) => allow.some((a) => a.key === f.key && a.kind === f.kind && f.msg.includes(a.match));
const left = findings.filter((f) => !isAllowed(f));
const stale = allow.filter((a) => !findings.some((f) => a.key === f.key && a.kind === f.kind && f.msg.includes(a.match)));
for (const a of stale) left.push({ key: a.key, kind: 'היתר ישן', msg: `ב-numbers-allow.json יש היתר ל"${a.match}" שכבר לא תואם שום ממצא - למחוק אותו` });

if (REPORT || left.length) {
  const out = REPORT ? findings : left;
  for (const f of out) console[REPORT ? 'log' : 'error'](`- [${f.kind}] ${f.msg}  (${f.key})${isAllowed(f) ? '  ✓ מוסבר' : ''}`);
}
if (left.length && !REPORT) {
  console.error(`\nבדיקת המספרים נכשלה: ${left.length} סתירות. לתקן את השנה או את הטקסט מול הכתוב`
    + ' - ואם זו ספירה אחרת ולא טעות, להוסיף ל-scripts/numbers-allow.json עם הסבר.');
  process.exit(1);
}
console.log(`check-numbers: ${Object.entries(seen).map(([k, n]) => `${n} ${k}`).join(', ')} · ${findings.length - left.length} מוסברים, ${left.length} סתירות`);
