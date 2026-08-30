// שער האיכות: טוען את התוצר האמיתי מ-dist בדפדפן אמיתי ונופל על כל שגיאה.
//
// למה זה קיים: `npm run build` עבר פעמיים על קוד שנפל בדפדפן (treeOpen לפני
// אתחול, הערת בלוק שבלעה שתי שורות import). בנייה שעברה אינה ראיה - ולכן
// הראיה נמצאת כאן, והיא רצה לבד בכל PR.
//
// מה נבדק בכל כתובת:
//   1. אין חריגת JS שלא נתפסה (pageerror) - זה הכשל שחזר פעמיים.
//   2. אין שגיאת קונסולה מקומית, כולל הפרות CSP (השרת כאן מגיש את אותן
//      כותרות מ-vercel.json, כדי שהפרה תיתפס כאן ולא בייצור).
//   3. אין בקשה שנכשלה לשרת שלנו (נכס חסר, chunk שלא נבנה).
//   4. המסך באמת התרנדר - בדיקת אלמנט לכל מסך, לא רק "הדף נטען".
//
// כל תעבורה החוצה נחסמת בכוונה: גם כדי שהריצה תהיה זהה בכל פעם, וגם כדי
// שבדיקות CI לא ירשמו שורות אמיתיות ב-si_trail.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html חסר. להריץ קודם `npm run build`.');
  process.exit(1);
}

/* ---------- שרת סטטי שמתנהג כמו Vercel ---------- */
// הכללים נקראים מ-vercel.json עצמו ולא משוכפלים כאן: אחרת הבדיקה תמשיך
// לעבור אחרי שינוי rewrite, והייצור יחזיר 404.
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const REWRITES = vercel.rewrites || [];
const HEADERS = (vercel.headers || []).flatMap((h) => (h.source === '/(.*)' ? h.headers : []));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  const rw = REWRITES.find((r) => r.source === urlPath);
  if (rw) urlPath = rw.destination;
  // normalize חוסם ../ - השרת הזה מגיש רק את dist
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\.]+)/, '');
  let full = join(DIST, rel);
  if (urlPath === '/' || urlPath === '') full = join(DIST, 'index.html');
  else if (existsSync(full) && statSync(full).isDirectory()) full = join(full, 'index.html');
  return existsSync(full) && statSync(full).isFile() ? full : null;
}

const server = createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0].replace(/\/$/, '') || '/';
  const file = resolveFile(urlPath);
  for (const h of HEADERS) res.setHeader(h.key, h.value);
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- הכתובות שנבדקות ---------- */
// שלוש נקודות הכניסה, ועוד שער אחד מכל סוג שה-prerender מייצר. השערים הם
// מה שגוגל מפנה אליו, ולכן דף שבור שם עולה יותר מדף שבור באפליקציה.
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
const firstOf = (re) => locs.find((u) => re.test(u));

const PAGES = [
  { url: '/', name: 'ציר הזמן', check: '#root > *' },
  { url: '/atlas', name: 'מסע הדורות', check: '#story > *' },
  { url: '/places', name: 'מפת הארץ', check: '#list > *' },
  { url: '/privacy', name: 'פרטיות', check: 'body' },
  { url: '/p', name: 'אינדקס שערים', check: 'a[href^="/p/"]' },
  // תבנית אחת מכל סוג שה-prerender מייצר: פריט, תקופה, מקום ואוסף
  { url: firstOf(/^\/p\/leader\//), name: 'שער פריט', check: 'h1' },
  { url: firstOf(/^\/p\/period\//), name: 'שער תקופה', check: 'h1' },
  { url: firstOf(/^\/p\/place\//), name: 'שער מקום', check: 'h1' },
  { url: firstOf(/^\/p\/collection\//), name: 'שער אוסף', check: 'h1' },
].filter((p) => p.url);

/* ---------- הרצה ---------- */
async function launch() {
  const tries = process.env.SMOKE_CHANNEL ? [process.env.SMOKE_CHANNEL] : ['chrome', 'msedge', null];
  for (const channel of tries) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch { /* לנסות את הבא */ }
  }
  console.error('לא נמצא דפדפן. להתקין Chrome, או להגדיר SMOKE_CHANNEL.');
  process.exit(1);
}

// /_vercel/insights הוא סקריפט ש-Vercel מזריק ומגיש בעצמו; מחוץ ל-Vercel הוא
// חסר בהגדרה, וה-404 שלו אינו כשל של האתר
const IGNORE = /\/_vercel\//;

const browser = await launch();
const failures = [];

for (const page of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // חסימת כל היעדים החיצוניים: ריצה זהה בכל פעם, ובלי לזהם את si_trail
  await ctx.route('**', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  const tab = await ctx.newPage();
  const errs = [];

  tab.on('pageerror', (e) => errs.push(`חריגת JS: ${e.message}`));
  tab.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // "Failed to load resource" מטופל בהמשך דרך response/requestfailed, שם יש
    // כתובת ואפשר להבחין בין נכס שלנו לבין יעד חיצוני שאנחנו עצמנו חסמנו
    if (/Failed to load resource/.test(text)) return;
    if (/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(text)) return;
    if (IGNORE.test(text)) return;
    errs.push(`קונסולה: ${text}`);
  });
  const local = (u) => u.startsWith(BASE) && !IGNORE.test(u);
  tab.on('response', (r) => {
    if (local(r.url()) && r.status() >= 400) errs.push(`${r.status()} על ${r.url().slice(BASE.length)}`);
  });
  tab.on('requestfailed', (r) => {
    if (local(r.url())) errs.push(`בקשה נכשלה: ${r.url().slice(BASE.length)} (${r.failure()?.errorText})`);
  });

  try {
    const res = await tab.goto(BASE + page.url, { waitUntil: 'load', timeout: 30000 });
    if (!res || res.status() >= 400) errs.push(`סטטוס ${res ? res.status() : '?'}`);
    else await tab.waitForSelector(page.check, { timeout: 15000, state: 'attached' });
  } catch (e) {
    errs.push(`לא התרנדר (${page.check}): ${String(e.message).split('\n')[0]}`);
  }

  if (errs.length) failures.push({ page, errs });
  console.log(`${errs.length ? '✗' : '✓'} ${page.name.padEnd(12)} ${page.url}`);
  for (const e of errs) console.log(`    ${e}`);
  await ctx.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n${failures.length} מתוך ${PAGES.length} כתובות נכשלו.`);
  process.exit(1);
}
console.log(`\n${PAGES.length} כתובות עברו נקי.`);
