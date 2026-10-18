/* דף דמות כ-PDF מקומי - לבדיקה ולשליחה. הדף עצמו (HTML, ההתאמה לעמוד, ה-QR)
   ב-sheet-html.mjs, אותו קוד שבונה את /p/<kind>/<id>/sheet באתר.

   שימוש:  node scripts/sheet.mjs united:david [leader:moshe ...]
   הפלט:   sheets-out/<kind>-<id>.pdf (+ .html לבדיקה), sheets-out ב-.gitignore.
   SHEET_FONT=classic|book - ערכות הגופנים שלא נבחרו, להשוואה (הפלט עם סיומת).
   SHEET_PAGES=2 - גרסת שני עמודים: הדמות, ואז המסע במפה גדולה (הפלט עם סיומת -2p).

   ה-PDF מודפס בדפדפן ולא נבנה בספריית PDF: עברית מימין לשמאל, ניקוד וסימני
   פיסוק יוצאים נכון רק במנוע של דפדפן. בסביבה בלי Chrome:
   SHEET_BROWSER=<נתיב ל-chromium> (או SMOKE_BROWSER). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { resolveKey } from '../src/data/items.js';
import { sheetHtml, mapJpeg, sheetStations, inlineFont, FONT_SETS } from './sheet-html.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'sheets-out');
const FONT_SET = process.env.SHEET_FONT || 'modern';
const PAGES = Number(process.env.SHEET_PAGES) === 2 ? 2 : 1;
if (!FONT_SETS[FONT_SET]) { console.error(`SHEET_FONT: ${Object.keys(FONT_SETS).join(' | ')}`); process.exit(1); }

async function launch() {
  const exe = process.env.SHEET_BROWSER || process.env.SMOKE_BROWSER;
  if (exe) return chromium.launch({ executablePath: exe });
  for (const channel of ['chrome', 'msedge', null]) {
    try { return await chromium.launch(channel ? { channel } : {}); } catch { /* הבא */ }
  }
  console.error('לא נמצא דפדפן. להתקין Chrome, או להגדיר SHEET_BROWSER לנתיב של chromium.');
  process.exit(1);
}

const keys = process.argv.slice(2);
if (!keys.length) { console.error('שימוש: node scripts/sheet.mjs <kind:id> ...  (למשל united:david)'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const key of keys) {
  const item = resolveKey(key);
  if (!item) { console.error(`אין פריט ${key}`); continue; }
  // בשני עמודים המפה ברוחב 150 מ"מ, ולכן ברזולוציה גבוהה יותר
  const mapSrc = sheetStations(item).length >= 2
    ? `data:image/jpeg;base64,${mapJpeg(item, PAGES === 2 ? 1100 : 760).toString('base64')}` : null;
  const html = sheetHtml(item, { fontSrc: inlineFont, mapSrc, fontSet: FONT_SET, pages: PAGES });
  const base = join(OUT, `${item.kind}-${item.id}${process.env.SHEET_FONT ? `-${FONT_SET}` : ''}${PAGES === 2 ? '-2p' : ''}`);
  writeFileSync(`${base}.html`, html);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  // ההתאמה לעמוד רצה בדף עצמו (FIT_JS) ומסמנת data-fit בסיומה
  await page.waitForFunction(() => document.documentElement.dataset.fit);
  const z = Number(await page.evaluate(() => document.documentElement.dataset.fit));
  await page.pdf({ path: `${base}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
  console.log(`${base}.pdf  (A4, ${z < 1 ? `הוקטן ל-${Math.round(z * 100)}%` : `הוגדל פי ${z.toFixed(2)}`})`);
}
await browser.close();
