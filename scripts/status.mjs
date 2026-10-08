/* תמונות סטטוס לוואטסאפ (1080x1920) מתוך קובץ תוכן אחד.

   למה תמונה ולא סטטוס טקסט: וואטסאפ מיישר טקסט לפי שפת האפליקציה ולא לפי
   שפת הטקסט, ובטלפון באנגלית עברית יוצאת מיושרת לשמאל. בתמונה היישור שלנו.

   כל התמונות יושבות על אותו רקע - איור הקלף של תמונת השיתוף (האיש עם המקל,
   build-assets/og-base.jpg). האיור רוחבי, ולכן הוא יושב בתחתית בגודלו המקורי
   כדי להישאר חד, והצד הריק שלו מוגדל לכל המסך כמרקם קלף.

   שימוש:
     npm run build                                  (רק אם יש שקפי site)
     node scripts/status.mjs scripts/status/<שם>.json
   הפלט: status-out/<שם>/01.jpg, 02.jpg... לפי סדר ההעלאה.

   סוגי שקפים (שדה type):
     intro  - eyebrow, title, p, steps[], hint   פתיחה: מה הסדרה ואיך עוקבים
     text   - title, paras[], question        טקסט שנגמר בשאלה
     verses - eyebrow, title, blocks[]        {v, ref} פסוק | {p, strong?, soft?} | {cite}
     site   - eyebrow, title, path, openMap?, stop?, crop?   צילום מסך מהאתר (מ-dist)
              crop: {from, to?, h?, pad?} - חיתוך לפי אלמנטים בעמוד, מראש from
              עד תחתית to (או h פיקסלים). from/to הם סלקטורים ככל ש-CSS מרשה,
              כולל רשימה (".map-wrap, .map-popup") - והחיתוך מקיף את כולם, כך
              שחלון קופץ שבולט מעל המפה לא נחתך.
              vh: גובה מסך הטלפון (ברירת מחדל 844) - כשהתוכן ארוך מהמסך.
              css: סגנון שמוזרק לצילום בלבד, למשל פריסת רשימה שנגללת באתר
              (".map-legend{max-height:none}") כדי שכל הפריטים ייראו. בלי crop נשמר מסך טלפון שלם, ואז הוא
              מוקטן לחצי מרוחב התמונה והטקסט שבו כמעט לא נקרא.
              game: {free?, place?, correct?, solve?, wait?, pick?, streak?} - צילום מהמשחק (/game). free: משחק חופשי
              עם כל התחומים והתקופות (ולא האתגר היומי - כדי לא לחשוף את התשובה של היום).
              place: כמה קלפים להניח לפני הצילום. solve: לפתור 5/5 ולצלם את מסך התוצאה
              (wait מ"ש אחרי "בדיקה" - 700 תופס את הקונפטי באוויר).
     cta    - eyebrow, title, p, url?, urlNote?, channel?   סיום עם כתובת האתר (url: למשל simpleisrael.co.il/game).
              urlNote מחליף את "בחינם, בלי הרשמה" שמתחת לכתובת - למשל כשהשקף מזכיר הרשמה במשחק
              וקופסת ערוץ הוואטסאפ מתחתיה (channel:false מסיר אותה)
     art    - image, eyebrow?, title[], labels?[]   איור מוכן על כל השקף (למשל מצ'אט GPT), עם כותרת
              בפינה ותוויות שם. image: נתיב יחסי לשורש הריפו. title: שורות הכותרת. labels:
              [{t, x, y}] - x/y באחוזים מרוחב/גובה האיור, נקודת העיגון היא מרכז התווית.
              box: {x, y, w} מיקום הכותרת בפיקסלים של 1080x1920 (ברירת מחדל: פינה שמאלית עליונה).

   תמונה לפוסט בערוץ (שדה post בראש הקובץ, לצד slides): eyebrow, title, blocks[] - אותם בלוקים
   של verses, ו-\n בתוך p שובר שורה. הפלט status-out/<שם>/post.jpg, לרוחב (1200x630, כמו תמונות
   השיתוף של האתר): בערוץ תמונה לאורך נחתכת בפיד, ולרוחב מוצגת במלואה. האיש עם המקל משמאל,
   הטקסט מימין. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FD = join(ROOT, 'node_modules', '@expo-google-fonts', 'frank-ruhl-libre');
const BG = join(ROOT, 'build-assets', 'og-base.jpg');
const DIST = join(ROOT, 'dist');
const CHANNEL_NAME = 'ציר הזמן של עם ישראל';
// הקישור הולך לכיתוב ולא לתמונה - בתמונה אי אפשר ללחוץ עליו
// אותו קישור ב-src/components/channel.js (האתר) - שינוי כאן = שינוי שם
const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb95vDvKAwElqCPM8T2L';

const specPath = process.argv[2];
if (!specPath) { console.error('שימוש: node scripts/status.mjs scripts/status/<שם>.json'); process.exit(1); }
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const OUT = join(ROOT, 'status-out', basename(specPath, '.json'));
mkdirSync(OUT, { recursive: true });
const TMP = mkdtempSync(join(tmpdir(), 'status-'));

/* ---------- טקסט ---------- */
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
/* גרשיים בתוך מילה (התנ"ך) וגרש אחרי אות (ה') הופכים לסימנים העבריים לפני
   שמזווגים מירכאות - אחרת הגרשיים של התנ"ך נסגרים עם פתיחת הציטוט הבא. */
const fmt = (s) => esc(s)
  .replace(/([א-ת])"([א-ת])/g, '$1״$2')
  .replace(/([א-ת])'(?=[\s,.:;]|$)/g, '$1׳')
  .replace(/"([^"]+)"/g, '<q>״$1״</q>')
  .replace(/ - /g, ' - ');

// כותרת: \n בטקסט = שבירת שורה מכוונת ("הירשמו.\nצברו נקודות.\nנצחו."), כשהשבירה האוטומטית חותכת באמצע
const ttl = (t) => esc(t).replace(/\n/g, '<br>');

const block = (b) => b.v
  ? `<blockquote><span class="vt">״${esc(b.v)}״</span><cite>${esc(b.ref)}</cite></blockquote>`
  : b.cite ? `<cite class="solo">${esc(b.cite)}</cite>`
  : `<p class="${[b.strong && 'strong', b.soft && 'soft'].filter(Boolean).join(' ')}">${fmt(b.p)}</p>`;

function body(s, shot) {
  const head = s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : '<div class="rule"></div>';
  if (s.type === 'text') return `${head}<h1>${ttl(s.title)}</h1>${s.paras.map((p) => `<p>${fmt(p)}</p>`).join('')}${s.question ? `<div class="qn">${esc(s.question)}</div>` : ''}`;
  if (s.type === 'verses') return `${head}<h1>${ttl(s.title)}</h1><main>${s.blocks.map(block).join('')}</main>`;
  if (s.type === 'site') return `${head}<h1 class="sm">${esc(s.title)}</h1><img class="shot${s.crop ? ' crop' : ''}" src="file://${shot}">`;
  if (s.type === 'intro') return `${head}<h1 class="xl">${esc(s.title)}</h1><p>${fmt(s.p)}</p>`
    + `<ol class="steps">${s.steps.map((t) => `<li>${fmt(t)}</li>`).join('')}</ol>`
    + (s.hint ? `<div class="hint">${esc(s.hint)}</div>` : '');
  /* ערוץ הוואטסאפ בכל שקף סיום (אוקטובר 2026, בקשת בעל האתר): סטטוס נעלם אחרי
     יממה, וערוץ הוא הדרך של מי שנהנה להמשיך לקבל. בתמונה אין קישור לחיצה, ולכן
     השם שמחפשים בלשונית "עדכונים"; הקישור עצמו הולך לכיתוב. channel:false מכבה. */
  if (s.type === 'cta') return `${head}<h1>${ttl(s.title)}</h1><p>${fmt(s.p)}</p><div class="urlbox">${esc(s.url || 'simpleisrael.co.il')}<small>${esc(s.urlNote || 'בחינם, בלי הרשמה')}</small></div>`
    + (s.channel === false ? '' : `<div class="chan"><b>📢 ערוץ הוואטסאפ</b><span>${esc(CHANNEL_NAME)}</span><small>דמות מהתנ״ך מדי פעם, ישר לטלפון</small></div>`);
  throw new Error(`סוג שקף לא מוכר: ${s.type}`);
}

/* שקף איור: התמונה ממלאת את כל השקף (ולא האיש עם המקל), והכותרת יושבת
   בחלק הריק שלה על שטיפת קלף רכה, כדי שתיקרא גם מעל פרטים באיור */
const artPage = (s) => {
  const img = join(ROOT, s.image);
  const box = { x: 46, y: 70, w: 500, ...(s.box || {}) };
  const labels = (s.labels || []).map((l) => `<span class="lb" style="left:${l.x}%;top:${l.y}%">${esc(l.t)}</span>`).join('');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:700;src:url(file://${FD}/700Bold/FrankRuhlLibre_700Bold.ttf)}
@font-face{font-family:F;font-weight:900;src:url(file://${FD}/900Black/FrankRuhlLibre_900Black.ttf)}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:F,serif}
.bg{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}
.tbox{position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;text-align:right}
/* כתוב בדיו על האיור עצמו, ולא תווית שמודבקת עליו: חום-ספיה של התחריט,
   והילה בצבע הקלף סביב האותיות כדי שיקראו גם מעל פרטים */
.ey{font-weight:700;font-size:36px;color:#6b4c12;margin-bottom:6px;
  text-shadow:0 0 6px #f7ecd0,0 0 14px #f7ecd0,0 0 22px #f7ecd0}
.tt{font-weight:900;font-size:104px;line-height:1;color:#3f2a0e;
  text-shadow:0 0 8px #f7ecd0,0 0 18px #f7ecd0,0 0 32px #f7ecd0,0 0 48px rgb(247 236 208 / .8)}
.lb{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-weight:900;font-size:44px;color:#3f2a0e;
  text-shadow:0 0 5px #f7ecd0,0 0 10px #f7ecd0,0 0 18px #f7ecd0,0 0 26px rgb(247 236 208 / .85)}
/* חתימה בתחתית, באותה דיו - כתובת האתר ולא לוגו, כדי שמי שרואה יידע לאן להיכנס */
.ft{position:absolute;left:0;right:0;bottom:46px;text-align:center;direction:ltr;font-weight:900;font-size:58px;color:#3f2a0e;
  text-shadow:0 0 8px #f7ecd0,0 0 18px #f7ecd0,0 0 30px #f7ecd0,0 0 44px rgb(247 236 208 / .85)}
</style></head><body>
<img class="bg" src="file://${img}">
<div class="tbox">${s.eyebrow ? `<div class="ey">${esc(s.eyebrow)}</div>` : ''}${(s.title || []).map((l) => `<div class="tt">${esc(l)}</div>`).join('')}</div>
${labels}
${s.foot ? `<div class="ft">${esc(s.foot)}</div>` : ''}
</body></html>`;
};

const page = (s, shot) => s.type === 'art' ? artPage(s) : `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:500;src:url(file://${FD}/500Medium/FrankRuhlLibre_500Medium.ttf)}
@font-face{font-family:F;font-weight:700;src:url(file://${FD}/700Bold/FrankRuhlLibre_700Bold.ttf)}
@font-face{font-family:F;font-weight:900;src:url(file://${FD}/900Black/FrankRuhlLibre_900Black.ttf)}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1920px;overflow:hidden;font-family:F,serif;color:#33281a}
body{position:relative;background:#ead7ab url(file://${BG}) right top/auto 1920px no-repeat}
.wash{position:absolute;inset:0;background:radial-gradient(ellipse 90% 60% at 50% 38%,rgb(251 245 231 / .62),rgb(251 245 231 / 0) 75%)}
.art{position:absolute;left:0;bottom:0;width:1080px;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 34%);mask-image:linear-gradient(to bottom,transparent 0,#000 34%)}
.content{position:relative;padding:230px 84px 0;display:flex;flex-direction:column}
.rule{width:180px;height:4px;background:#a8842c;margin-bottom:34px}
/* שורת הגג בחום: 40px היו קטנים מדי לקריאה במבט ראשון בטלפון (הערת בעל האתר) */
.eyebrow{font-weight:800;font-size:54px;line-height:1.2;color:#6b4a0f;padding-bottom:24px;margin-bottom:36px;border-bottom:3px solid rgb(168 132 44 / .45)}
h1{font-weight:900;font-size:98px;line-height:1.08;color:#163a57;margin-bottom:44px;text-wrap:balance}
h1.sm{font-size:74px;margin-bottom:40px}
p{font-weight:500;font-size:47px;line-height:1.5;margin-bottom:30px;text-wrap:pretty}
p.strong{font-weight:700;color:#163a57;text-wrap:balance}
p.soft{color:#6d5c42;font-size:43px}
q{quotes:none;font-weight:700;color:#7a5410}
.qn{font-weight:900;font-size:76px;color:#163a57;margin-top:14px}
main{display:flex;flex-direction:column;gap:30px}
main p{margin:0}
/* כמו .dc-verse באתר: שטוח בצד הקו, מעוגל בצד השני */
blockquote{background:rgb(251 245 231 / .7);border-inline-start:10px solid #b28a2b;
  border-start-end-radius:26px;border-end-end-radius:26px;padding:34px 44px 30px}
.vt{display:block;font-weight:700;font-size:54px;line-height:1.42;text-wrap:balance}
cite{display:block;font-style:normal;font-weight:700;font-size:34px;color:#7a5b16;margin-top:16px}
cite.solo{margin-top:-18px}
/* הצילום בצד ימין והאיש עם המקל בצד שמאל (עד x=300), ולכן הצילום רשאי לרדת
   נמוך יותר משאר התוכן בלי לעלות עליו - כל עוד רוחבו עד 680 */
.shot{align-self:flex-start;max-width:680px;max-height:1180px;border-radius:34px;border:6px solid #fbf5e7;
  box-shadow:0 26px 60px rgb(60 40 0 / .38)}
/* חיתוך: רק החלק החשוב, מוגדל עד כל רוחב התמונה - בערך גודל הקריאה האמיתי באתר */
.shot.crop{max-width:912px;max-height:1090px}
h1.xl{font-size:118px;line-height:1.04}
/* השלבים הם רצף אמיתי - סדר ההעלאה - ולכן ממוספרים */
.steps{list-style:none;padding:0;margin:14px 0 0;display:flex;flex-direction:column;gap:22px;counter-reset:st}
.steps li{counter-increment:st;display:flex;align-items:center;gap:26px;font-weight:700;font-size:46px;line-height:1.3;
  background:rgb(251 245 231 / .7);border-radius:22px;padding:22px 28px}
.steps li::before{content:counter(st);flex:none;width:70px;height:70px;border-radius:50%;background:#163a57;color:#e7c873;
  display:flex;align-items:center;justify-content:center;font-weight:900;font-size:40px}
.hint{margin-top:40px;font-weight:700;font-size:38px;color:#7a5b16}
.urlbox{margin-top:40px;background:#163a57;color:#fff;border-radius:28px;padding:40px;text-align:center;direction:ltr;font-weight:700;font-size:64px}
.chan{margin-top:26px;border:4px solid #25a35a;background:rgb(251 245 231 / .85);border-radius:28px;padding:26px 34px;text-align:center}
.chan b{display:block;font-size:40px;color:#1d7a45}
.chan span{display:block;font-weight:900;font-size:56px;color:#163a57;margin-top:4px}
.chan small{display:block;font-size:34px;font-weight:500;color:#6d5c42;margin-top:6px}
.urlbox small{display:block;direction:rtl;font-size:36px;font-weight:500;color:#e7d9ba;margin-top:10px}
.url{position:absolute;right:84px;bottom:230px;font-weight:700;font-size:36px;color:#163a57;direction:ltr}
</style></head><body>
<div class="wash"></div>
<img class="art" src="file://${BG}">
<div class="content">${body(s, shot)}</div>
${s.type === 'cta' ? '' : `<div class="url">${esc(s.footUrl || 'simpleisrael.co.il')}</div>`}
</body></html>`;

/* ---------- תמונה לפוסט בערוץ ---------- */
const postBlock = (b) => b.p ? `<p>${fmt(b.p).replace(/\n/g, '<br>')}</p>` : block(b);
const postPage = (s) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:F;font-weight:500;src:url(file://${FD}/500Medium/FrankRuhlLibre_500Medium.ttf)}
@font-face{font-family:F;font-weight:700;src:url(file://${FD}/700Bold/FrankRuhlLibre_700Bold.ttf)}
@font-face{font-family:F;font-weight:900;src:url(file://${FD}/900Black/FrankRuhlLibre_900Black.ttf)}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden;font-family:F,serif;color:#33281a}
body{position:relative;background:#ead7ab url(file://${BG}) center/cover no-repeat}
/* מימין לאיש עם המקל, שמגיע עד x=330 */
.content{position:absolute;right:70px;top:52px;width:760px}
.eyebrow{font-weight:700;font-size:30px;color:#6b4a0f;padding-bottom:12px;margin-bottom:18px;border-bottom:2px solid rgb(168 132 44 / .45)}
h1{font-weight:900;font-size:76px;line-height:1.05;color:#163a57;margin-bottom:22px}
blockquote{background:rgb(251 245 231 / .75);border-inline-start:7px solid #b28a2b;
  border-start-end-radius:18px;border-end-end-radius:18px;padding:18px 26px 14px;margin-bottom:22px}
.vt{display:block;font-weight:700;font-size:33px;line-height:1.4}
cite{display:block;font-style:normal;font-weight:700;font-size:22px;color:#7a5b16;margin-top:8px}
p{font-weight:700;font-size:29px;line-height:1.4;color:#163a57;margin-bottom:14px}
q{quotes:none;color:#7a5410}
.url{position:absolute;left:88px;bottom:44px;font-weight:700;font-size:28px;color:#163a57;direction:ltr;
  background:rgb(251 245 231 / .8);padding:4px 14px;border-radius:10px}
</style></head><body>
<div class="content">${s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : ''}<h1>${ttl(s.title)}</h1>${(s.blocks || []).map(postBlock).join('')}</div>
<div class="url">${esc(s.footUrl || 'simpleisrael.co.il')}</div>
</body></html>`;

/* ---------- צילומי מסך מהאתר ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function serveDist() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (['/atlas', '/places', '/game'].includes(p)) p += '.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(r);
  });
  return new Promise((res) => srv.listen(0, () => res(srv)));
}

async function playGame(pg, g) {
  const startFree = async () => {
    await pg.getByRole('tab', { name: 'משחק חופשי' }).click();
    await pg.locator('.gm-group').nth(0).locator('.gm-all').click();
    await pg.locator('.gm-group').nth(1).locator('.gm-all').click();
    await pg.getByRole('button', { name: 'הפעל' }).click();
  };
  /* pick: {topics:[...], periods:[...]} - מסך הבחירה של המשחק החופשי, עם בחירה
     מסומנת ובלי "הפעל": צילום של "משחק מותאם אישית". התוויות כפי שהן על הכפתורים */
  if (g.pick) {
    await pg.getByRole('tab', { name: 'משחק חופשי' }).click();
    for (const [i, labels] of [[0, g.pick.topics || []], [1, g.pick.periods || []]]) {
      for (const l of labels) await pg.locator('.gm-group').nth(i).locator('.gm-topic', { hasText: l }).first().click();
    }
    await pg.waitForTimeout(300);
    return;
  }
  if (g.free) await startFree();
  // "exact" - "יהושע" לא יתפוס את "יהושע בן נון"
  const exact = (n) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const card = (n) => pg.locator('.gm-pool .gm-card').filter({ has: pg.locator('.gm-name', { hasText: exact(n) }) }).first();
  /* הסדר הנכון נלמד מסבב ראשון שגוי, ואז רענון מחזיר את אותה יד (Math.random עם זרע) */
  let order = null;
  if (g.solve || g.correct) {
    for (let k = 0; k < 5; k++) await pg.locator('.gm-pool .gm-card').first().click();
    await pg.getByRole('button', { name: 'בדיקה' }).click();
    order = await pg.locator('.gm-answer .gm-name').allTextContents();
    await pg.evaluate(() => localStorage.removeItem('si_game_daily'));
    await pg.reload({ waitUntil: 'networkidle' });
    if (g.free) await startFree();
  }
  if (g.solve) {
    for (const n of order) await card(n).click();
    await pg.getByRole('button', { name: 'בדיקה' }).click();
    await pg.waitForTimeout(g.wait ?? 700);
    return;
  }
  // place: כמה קלפים להניח. correct: לפי הסדר הנכון, כדי שהצילום לא יראה טעות
  for (let k = 0; k < (g.place || 0); k++) await (order ? card(order[k]) : pg.locator('.gm-pool .gm-card').first()).click();
  await pg.waitForTimeout(300);
}

async function siteShot(browser, base, s, i) {
  // מסך טלפון (390x844) בצפיפות 3 - כמו צילום מסך אמיתי מאייפון
  const ctx = await browser.newContext({ viewport: { width: 390, height: s.vh || 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('si_seen_intro', '1'); } catch { /* */ } });
  // בלי תעבורה החוצה - וגם בלי שורות אמיתיות ב-si_trail
  await ctx.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  /* במשחק: Math.random עם זרע קבוע, בצילום בלבד. כך אותה יד חוזרת אחרי רענון -
     סבב ראשון שגוי חושף את הסדר הנכון, ובשני מסדרים אותו ומקבלים 5/5 */
  if (s.game) {
    await ctx.addInitScript(() => {
      let a = 20260929;
      Math.random = () => {
        a = (a + 0x6d2b79f5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    });
  }
  /* streak: N - רצף פעיל של N ימים שמסתיים אתמול, כדי לצלם את התזכורת "רצף של N ימים -
     פתרו היום כדי להמשיך". רצף לדוגמה של המכשיר המצלם בלבד, לא נתון של אף שחקן */
  if (s.game?.streak) {
    await ctx.addInitScript((n) => {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
      const [y, m, d] = day.split('-').map(Number);
      const num = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 9, 5)) / 864e5) + 1;
      try { localStorage.setItem('si_game_streak', JSON.stringify({ last: num - 1, count: n, best: n })); } catch { /* */ }
    }, s.game.streak);
  }
  const pg = await ctx.newPage();
  await pg.goto(base + s.path, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  if (s.game) await playGame(pg, s.game);
  if (s.css) await pg.addStyleTag({ content: s.css });
  if (s.openMap) { await pg.locator('.dc-map-cta').first().click(); await pg.waitForTimeout(1200); }
  if (s.stop) { await pg.locator('.map-legend li').filter({ hasText: s.stop }).first().click(); await pg.waitForTimeout(1200); }
  const file = join(TMP, `shot-${i}.png`);
  let clip = { x: 0, y: 0, width: 390, height: s.vh || 844 };
  if (s.crop) {
    const { from, to, h, pad = 8 } = s.crop;
    clip = await pg.evaluate(({ from, to, h, pad }) => {
      const rects = (sel) => (sel ? [...document.querySelectorAll(sel)] : [])
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
      const a = rects(from), b = rects(to), all = [...a, ...b];
      if (!a.length) return null;
      const top = Math.min(...a.map((r) => r.top));
      const x = Math.max(0, Math.min(...all.map((r) => r.left)) - pad);
      const y = Math.max(0, top - pad);
      const right = Math.min(innerWidth, Math.max(...all.map((r) => r.right)) + pad);
      const end = b.length ? Math.max(...all.map((r) => r.bottom)) + pad : top + h;
      const bottom = Math.min(innerHeight, end);
      return { x, y, width: right - x, height: bottom - y, cut: end > innerHeight };
    }, { from, to, h, pad });
    if (!clip) throw new Error(`crop: לא נמצא ${from} ב-${s.path}`);
    if (clip.cut) console.log(`⚠ שקף ${i + 1}: החיתוך נמשך מתחת למסך ונקטע - להגדיל vh`);
    delete clip.cut;
  }
  await pg.screenshot({ path: file, clip });
  await ctx.close();
  return file;
}

async function launch() {
  const exe = process.env.STATUS_BROWSER || process.env.SMOKE_BROWSER;
  if (exe) return chromium.launch({ executablePath: exe });
  for (const channel of ['chrome', 'msedge', null]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch { /* הבא */ }
  }
  console.error('לא נמצא דפדפן. להתקין Chrome, או להגדיר STATUS_BROWSER לנתיב של chromium.');
  process.exit(1);
}

/* ---------- הרצה ---------- */
const needsSite = spec.slides.some((s) => s.type === 'site');
if (needsSite && !existsSync(join(DIST, 'index.html'))) { console.error('אין dist - קודם npm run build'); process.exit(1); }
const browser = await launch();
const srv = needsSite ? await serveDist() : null;
const base = srv ? `http://localhost:${srv.address().port}` : '';
const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
let bad = 0;
for (const [i, s] of spec.slides.entries()) {
  const shot = s.type === 'site' ? await siteShot(browser, base, s, i) : null;
  const html = join(TMP, `s${i}.html`);
  writeFileSync(html, page(s, shot));
  await pg.goto(`file://${html}`, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  // התוכן צריך להיגמר מעל האיור; מתחת ל-1560 הוא עולה על האיש עם המקל.
  // צילום מסך צר יושב מימין לאיש ולכן מותר לו לרדת עד מעל שורת הכתובת.
  const m = await pg.evaluate(() => {
    const r = (e) => e && e.getBoundingClientRect();
    // בשקף איור אין .content - הוא ממלא את כל השקף בכוונה, ואין גבול לבדוק
    const c = r(document.querySelector('.content')), shot = r(document.querySelector('.shot'));
    if (!c) return { bottom: 0, shot: null };
    return { bottom: Math.round(c.bottom), shot: shot && { left: Math.round(shot.left), bottom: Math.round(shot.bottom) } };
  });
  // צילום רחב (x<310) כבר אינו מימין לאיש עם המקל, ולכן חל עליו הגבול הרגיל
  const wide = m.shot && m.shot.left < 310;
  const bottom = m.bottom;
  const limit = s.type === 'site' && !wide ? 1650 : 1560;
  if (process.env.STATUS_DEBUG) console.log(JSON.stringify(m));
  const name = `${String(i + 1).padStart(2, '0')}.jpg`;
  if (bottom > limit) { bad++; console.log(`⚠ ${name}: התוכן נגמר ב-${bottom}px, עולה על האיור - לקצר`); }
  await pg.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 90 });
  console.log(`✓ ${name}  ${s.type}  ${s.title || ''}`);
}
if (spec.post) {
  const pp = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const html = join(TMP, 'post.html');
  writeFileSync(html, postPage(spec.post));
  await pp.goto(`file://${html}`, { waitUntil: 'load' });
  await pp.evaluate(() => document.fonts.ready);
  // מעל 590 התוכן נוגע בשולי התמונה
  const bottom = await pp.evaluate(() => Math.round(document.querySelector('.content').getBoundingClientRect().bottom));
  if (bottom > 590) { bad++; console.log(`⚠ post.jpg: התוכן נגמר ב-${bottom}px מתוך 630 - לקצר`); }
  await pp.screenshot({ path: join(OUT, 'post.jpg'), type: 'jpeg', quality: 88 });
  console.log(`✓ post.jpg  פוסט לערוץ  ${spec.post.title}`);
}
await browser.close();
srv?.close();
console.log(`\n${spec.slides.length} תמונות${spec.post ? ' ותמונה לערוץ' : ''} ב-${OUT}`);
console.log(`לכיתוב, בשורה מתחת לקישור לאתר:\n📢 הערוץ: ${CHANNEL_URL}`);
process.exit(bad ? 1 : 0);
