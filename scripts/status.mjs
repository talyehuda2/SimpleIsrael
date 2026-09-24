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
     text   - title, paras[], question        טקסט שנגמר בשאלה
     verses - eyebrow, title, blocks[]        {v, ref} פסוק | {p, strong?, soft?} | {cite}
     site   - eyebrow, title, path, openMap?, stop?, crop?   צילום מסך מהאתר (מ-dist)
              crop: {from, to?, h?, pad?} - חיתוך לפי אלמנטים בעמוד, מראש from
              עד תחתית to (או h פיקסלים). בלי crop נשמר מסך טלפון שלם, ואז הוא
              מוקטן לחצי מרוחב התמונה והטקסט שבו כמעט לא נקרא.
     cta    - eyebrow, title, p               סיום עם כתובת האתר */
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

const block = (b) => b.v
  ? `<blockquote><span class="vt">״${esc(b.v)}״</span><cite>${esc(b.ref)}</cite></blockquote>`
  : b.cite ? `<cite class="solo">${esc(b.cite)}</cite>`
  : `<p class="${[b.strong && 'strong', b.soft && 'soft'].filter(Boolean).join(' ')}">${fmt(b.p)}</p>`;

function body(s, shot) {
  const head = s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : '<div class="rule"></div>';
  if (s.type === 'text') return `${head}<h1>${esc(s.title)}</h1>${s.paras.map((p) => `<p>${fmt(p)}</p>`).join('')}${s.question ? `<div class="qn">${esc(s.question)}</div>` : ''}`;
  if (s.type === 'verses') return `${head}<h1>${esc(s.title)}</h1><main>${s.blocks.map(block).join('')}</main>`;
  if (s.type === 'site') return `${head}<h1 class="sm">${esc(s.title)}</h1><img class="shot${s.crop ? ' crop' : ''}" src="file://${shot}">`;
  if (s.type === 'cta') return `${head}<h1>${esc(s.title)}</h1><p>${fmt(s.p)}</p><div class="urlbox">simpleisrael.co.il<small>בחינם, בלי הרשמה</small></div>`;
  throw new Error(`סוג שקף לא מוכר: ${s.type}`);
}

const page = (s, shot) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
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
.eyebrow{font-weight:700;font-size:40px;color:#7a5b16;padding-bottom:22px;margin-bottom:36px;border-bottom:3px solid rgb(168 132 44 / .45)}
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
.urlbox{margin-top:40px;background:#163a57;color:#fff;border-radius:28px;padding:40px;text-align:center;direction:ltr;font-weight:700;font-size:64px}
.urlbox small{display:block;direction:rtl;font-size:36px;font-weight:500;color:#e7d9ba;margin-top:10px}
.url{position:absolute;right:84px;bottom:230px;font-weight:700;font-size:36px;color:#163a57;direction:ltr}
</style></head><body>
<div class="wash"></div>
<img class="art" src="file://${BG}">
<div class="content">${body(s, shot)}</div>
${s.type === 'cta' ? '' : '<div class="url">simpleisrael.co.il</div>'}
</body></html>`;

/* ---------- צילומי מסך מהאתר ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function serveDist() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (['/atlas', '/places'].includes(p)) p += '.html';
    if (p.endsWith('/')) p += 'index.html';
    const f = join(DIST, p);
    if (!f.startsWith(DIST) || !existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(r);
  });
  return new Promise((res) => srv.listen(0, () => res(srv)));
}

async function siteShot(browser, base, s, i) {
  // מסך טלפון (390x844) בצפיפות 3 - כמו צילום מסך אמיתי מאייפון
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('si_seen_intro', '1'); } catch { /* */ } });
  // בלי תעבורה החוצה - וגם בלי שורות אמיתיות ב-si_trail
  await ctx.route('**', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  const pg = await ctx.newPage();
  await pg.goto(base + s.path, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  if (s.openMap) { await pg.locator('.dc-map-cta').first().click(); await pg.waitForTimeout(1200); }
  if (s.stop) { await pg.locator('.map-legend li').filter({ hasText: s.stop }).first().click(); await pg.waitForTimeout(1200); }
  const file = join(TMP, `shot-${i}.png`);
  let clip = { x: 0, y: 0, width: 390, height: 844 };
  if (s.crop) {
    const { from, to, h, pad = 8 } = s.crop;
    clip = await pg.evaluate(({ from, to, h, pad }) => {
      const a = document.querySelector(from)?.getBoundingClientRect();
      if (!a) return null;
      const b = to ? document.querySelector(to)?.getBoundingClientRect() : null;
      const x = Math.max(0, Math.min(a.left, b ? b.left : a.left) - pad);
      const y = Math.max(0, a.top - pad);
      const right = Math.min(innerWidth, Math.max(a.right, b ? b.right : a.right) + pad);
      const bottom = Math.min(innerHeight, b ? b.bottom + pad : a.top + h);
      return { x, y, width: right - x, height: bottom - y };
    }, { from, to, h, pad });
    if (!clip) throw new Error(`crop: לא נמצא ${from} ב-${s.path}`);
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
    const c = r(document.querySelector('.content')), shot = r(document.querySelector('.shot'));
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
await browser.close();
srv?.close();
console.log(`\n${spec.slides.length} תמונות ב-${OUT}`);
process.exit(bad ? 1 : 0);
