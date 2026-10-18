/* "דמות היום" - פריט אחד ליום, זהה לכולם, להתראה היומית (api/push-daily.js).

   הסדר: הדמויות והאירועים מסודרים פעם אחת בזרע קבוע, ויום N מקבל את הפריט
   ה-N בסבב, בלי חזרה עד שהסבב (כ-120 ימים) נגמר. ספרים, אימפריות ושליטים זרים
   לא נכנסים: "דמות היום" היא מישהו מתולדות ישראל, או אירוע.

   שני כללים בסידור (אוקטובר 2026): מוכר ופחות מוכר לסירוגין, ולא שני פריטים
   רצופים מאותה תקופה. ערבוב אקראי לבדו פתח את הסבב ביהויכין, יואש, אמון
   ויהואחז - ובשבועות הראשונים נקבע אם מי שנרשם נשאר. "מוכר" הוא אותו מאגר של
   האתגר היומי במשחק (familiar ב-pool.js): כל האבות, המלכים המאוחדים והאירועים,
   ושופטים, מלכים ונביאים ידועים.

   ימים מיוחדים יוצאים מהסבב (בקשת בעל האתר, אוקטובר 2026): ביום שישי - דמות
   או אירוע מפרשת השבוע (או מההפטרה שלה), ובחגים ובצומות - האירוע שלהם. מי שבחר
   "פעם בשבוע" מקבל רק את שישי, ולכן דווקא שם הקשר לשבת. פרשה בלי קשר טוב לאתר
   (ויקרא, עקב...) נשארת יום רגיל. הסבב סופר רק ימים רגילים, כך שאף פריט לא
   "נבלע" ביום מיוחד.

   מוסיפים פריט לנתונים = הסבב משתנה מאותו יום. זה בסדר - אין התחייבות
   לסדר מסוים, רק לכך שכולם מקבלים אותו פריט באותו יום. */
import { ALL_ITEMS, SORTED_PERIODS } from '../data/items.js';
import { rng, israelDay, familiar, inPeriod } from '../game/pool.js';
import PARASHOT from './parashot.json' with { type: 'json' };

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

/* פרשת השבוע -> [שם הפרשה, פריט, למה]. "למה" מופיע בהתראה מעל התיאור, ולכן
   חובה כשהקשר אינו מובן מאליו - בעיקר כשהוא מההפטרה. מפתחות הפרשות כמו
   ב-parashot.json (scripts/parashot.mjs, לוח ארץ ישראל). כל קשר נבדק מול הפסוק. */
const PARASHA = {
  'Lech-Lecha': ['לך לך', 'leader:avraham', 'בפרשה: "לך לך מארצך" - אברהם עולה לארץ'],
  Vayera: ['וירא', 'event:akeida', null],
  'Chayei Sara': ['חיי שרה', 'leader:sarah', 'הפרשה נפתחת במות שרה ובקבורתה במערת המכפלה'],
  Toldot: ['תולדות', 'leader:rivka', null],
  Vayetzei: ['ויצא', 'leader:yaakov', null],
  Vayishlach: ['וישלח', 'leader:rachel', 'בפרשה: מות רחל בדרך אפרתה'],
  Vayeshev: ['וישב', 'leader:yosef', null],
  Miketz: ['מקץ', 'leader:yosef', 'בפרשה: יוסף עולה לגדולה במצרים'],
  Vayigash: ['ויגש', 'event:yerida-lemitzrayim', null],
  Vayechi: ['ויחי', 'event:shibud', 'הפרשה ובראשית כולו מסתיימים במות יוסף'],
  Shemot: ['שמות', 'leader:moshe', 'בפרשה: הולדת משה והסנה הבוער'],
  Vaera: ['וארא', 'prophet:yechezkel', 'בהפטרת הפרשה: יחזקאל מתנבא על פרעה מלך מצרים'],
  Bo: ['בא', 'event:yetziat-mitzrayim', null],
  Beshalach: ['בשלח', 'leader:miriam', 'בפרשה: מרים והנשים שרות על הים'],
  Yitro: ['יתרו', 'event:matan-torah', null],
  Mishpatim: ['משפטים', 'judah:tzidkiyahu', 'בהפטרת הפרשה: צדקיהו מכריז דרור לעבדים, ובעליהם חוזרים בהם'],
  Terumah: ['תרומה', 'united:shlomo', 'בהפטרת הפרשה: שלמה מתחיל לבנות את בית המקדש'],
  Tetzaveh: ['תצוה', 'leader:aharon', 'בפרשה: בגדי הכהונה של אהרן'],
  'Ki Tisa': ['כי תשא', 'prophet:eliyahu', 'בהפטרת הפרשה: אליהו מול נביאי הבעל בהר הכרמל'],
  Vayakhel: ['ויקהל', 'event:binyan-bayit1', 'בהפטרת הפרשה: חירם עושה את כלי בית המקדש של שלמה'],
  Pekudei: ['פקודי', 'event:binyan-bayit1', 'בהפטרת הפרשה: שלמה משלים את מלאכת בית המקדש'],
  'Vayakhel-Pekudei': ['ויקהל-פקודי', 'event:binyan-bayit1', 'בהפטרת הפרשה: כלי בית המקדש של שלמה'],
  Shmini: ['שמיני', 'united:david', 'בהפטרת הפרשה: דוד מעלה את ארון ה\' לירושלים'],
  Tazria: ['תזריע', 'prophet:elisha', 'בהפטרת הפרשה: אלישע מרפא את נעמן מצרעתו'],
  Metzora: ['מצורע', 'prophet:elisha', 'בהפטרת הפרשה: ארבעת המצורעים בימי אלישע'],
  'Tazria-Metzora': ['תזריע-מצורע', 'prophet:elisha', 'בהפטרת הפרשה: ארבעת המצורעים בימי אלישע'],
  'Achrei Mot': ['אחרי מות', 'leader:aharon', 'בפרשה: עבודת אהרן ביום הכיפורים'],
  'Achrei Mot-Kedoshim': ['אחרי מות-קדושים', 'leader:aharon', 'בפרשה: עבודת אהרן ביום הכיפורים'],
  Behar: ['בהר', 'prophet:yirmiyahu', 'בהפטרת הפרשה: ירמיהו קונה את השדה בענתות'],
  Bamidbar: ['במדבר', 'prophet:hoshea-p', 'בהפטרת הפרשה: נבואת הושע שבני ישראל יהיו כחול הים'],
  Nasso: ['נשא', 'judge:shimshon', 'בהפטרת הפרשה: המלאך מבשר על הולדת שמשון'],
  "Beha'alotcha": ['בהעלותך', 'prophet:zecharya-p', 'בהפטרת הפרשה: חזון המנורה של זכריה'],
  "Sh'lach": ['שלח', 'event:meraglim', null],
  Korach: ['קורח', 'prophet:shmuel', 'בהפטרת הפרשה: שמואל מחדש את המלוכה בגלגל'],
  Chukat: ['חוקת', 'judge:yiftach', 'בהפטרת הפרשה: יפתח והמלחמה בבני עמון'],
  Balak: ['בלק', 'prophet:micha', 'בהפטרת הפרשה: מיכה מזכיר את בלק ובלעם'],
  Pinchas: ['פינחס', 'leader:yehoshua-l', 'בפרשה: משה סומך את יהושע לממלא מקומו'],
  Matot: ['מטות', 'prophet:yirmiyahu', 'בהפטרת הפרשה: הקדשת ירמיהו לנבואה'],
  Masei: ['מסעי', 'prophet:yirmiyahu', 'ההפטרה מספר ירמיהו, בשלושת השבועות'],
  'Matot-Masei': ['מטות-מסעי', 'prophet:yirmiyahu', 'ההפטרה מספר ירמיהו, בשלושת השבועות'],
  Devarim: ['דברים', 'prophet:yeshayahu', 'שבת חזון: ההפטרה היא חזון ישעיהו'],
  Vaetchanan: ['ואתחנן', 'leader:moshe', 'בפרשה: משה מתחנן להיכנס לארץ'],
  'Ki Tavo': ['כי תבוא', 'event:knisa', 'הפרשה פותחת ב"והיה כי תבוא אל הארץ"'],
  Vayeilech: ['וילך', 'leader:yehoshua-l', 'בפרשה: משה מחזק את יהושע לפני מותו'],
  'Nitzavim-Vayeilech': ['נצבים-וילך', 'leader:yehoshua-l', 'בפרשה: משה מחזק את יהושע לפני מותו'],
  "Ha'azinu": ['האזינו', 'leader:moshe', 'בפרשה: שירת משה, לפני מותו'],
};

/* חגים וצומות, לפי התאריך העברי (Intl, כמו holy.js) -> [כותרת, פריט, למה].
   רק ימים שבהם יוצאת התראה: לא החג עצמו ולא ערבו (holy.js), ולכן פסח בט"ז
   ניסן ושבועות בד' סיוון. פורים באדר, ובשנה מעוברת באדר ב'. */
const HOLIDAYS = {
  'Tishri 3': ['לצום גדליה', 'event:retzach-gedalya', null],
  'Tishri 16': ['לסוכות', 'event:binyan-bayit1', 'שלמה חנך את בית המקדש בחג הסוכות'],
  'Kislev 25': ['לחנוכה', 'event:chanuka', null],
  'Tevet 10': ['לעשרה בטבת', 'event:churban1', 'בעשרה בטבת החל המצור של נבוכדנצר על ירושלים'],
  'Adar 14': ['לפורים', 'event:purim', null],
  'Adar II 14': ['לפורים', 'event:purim', null],
  'Nisan 16': ['לפסח', 'event:yetziat-mitzrayim', null],
  'Iyar 28': ['ליום ירושלים', 'event:kibush-yerushalayim', null],
  'Sivan 4': ['לקראת שבועות', 'event:matan-torah', null],
  'Tamuz 17': ['לשבעה עשר בתמוז', 'event:churban2', 'בשבעה עשר בתמוז הובקעה חומת ירושלים, בחורבן הבית השני'],
  'Av 9': ['לתשעה באב', 'event:churban1', null],
};

const BY_KEY = new Map(ALL_ITEMS.map((x) => [`${x.kind}:${x.id}`, x]));
const heb = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long' });
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const at = (day) => Date.parse(`${day}T00:00:00Z`);

const memo = new Map();
function special(day) {
  if (memo.has(day)) return memo.get(day);
  const p = Object.fromEntries(heb.formatToParts(new Date(at(day) + DAY / 2)).map((x) => [x.type, x.value]));
  let r = null;
  const h = HOLIDAYS[`${p.month} ${p.day}`];
  const w = new Date(at(day)).getUTCDay() === 5 && PARASHA[PARASHOT[iso(at(day) + DAY)]];
  const [prefix, key, why] = h || (w ? [`לשבת פרשת ${w[0]}`, w[1], w[2]] : []);
  const it = key && BY_KEY.get(key);
  if (it) r = { it, title: `${prefix}: ${it.name}`, why };
  memo.set(day, r);
  return r;
}

/** מה יוצא ביום מסוים בשעון ישראל ('2026-10-18'), או היום: { it, title, why } */
export function dailyPick(day = israelDay()) {
  const s = special(day);
  if (s) return s;
  const list = cycle();
  let n = 0;
  for (let t = START; t < at(day); t += DAY) if (!special(iso(t))) n++;
  const it = list[n % list.length];
  return { it, title: `${it.kind === 'event' ? 'אירוע היום' : 'דמות היום'}: ${it.name}`, why: null };
}

export const dailyItem = (day) => dailyPick(day).it;

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

