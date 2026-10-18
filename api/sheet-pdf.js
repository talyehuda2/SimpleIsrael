/* "הורדת PDF" של דף דמות: מדפיס את עמוד הדף (/p/<kind>/<id>/sheet) בדפדפן
   ומחזיר קובץ PDF להורדה.

   למה בשרת: בהתחלה "הורדה" הייתה window.print(), ובטלפון חלון ההדפסה נפתח על
   המדפסת האחרונה ("This printer isn't available") - בעל האתר, אוקטובר 2026.
   הורדה אמיתית צריכה קובץ, ו-PDF מוכן מראש היה מתיישן עם כל תיקון תוכן, ול-Vercel
   אין דפדפן בבנייה. כאן הקובץ נוצר בבקשה הראשונה מהעמוד החי, ונשמר במטמון של
   Vercel עד הפריסה הבאה (המטמון שייך לפריסה) - כך הוא תמיד כמו הדף.

   הדפדפן: @sparticuz/chromium (Chromium דחוס לפונקציות שרת, נפרס ל-/tmp), דרך
   playwright-core. הקבצים שלו נכנסים לפונקציה ב-includeFiles שב-vercel.json.

   ?k=<kind:id>   הדמות - רק מפתח קיים עם דף (hasSheet), ולכן הכתובת שנפתחת
                  נבנית מהנתונים ולא מהבקשה
   ?p=2           גרסת שני העמודים (רק לדמות עם מסע) */
import chromium from '@sparticuz/chromium';
import { chromium as pw } from 'playwright-core';
import { resolveKey } from '../src/data/items.js';
import { hasSheet, sheetPath } from '../src/utils/sheet.js';
import maps from '../src/data/maps.json' with { type: 'json' };
import { journeyStations } from '../src/utils/mapProject.js';

// העמוד שמודפס: באתר עצמו. SHEET_ORIGIN - לבדיקה מקומית מול שרת של dist
const origin = () => process.env.SHEET_ORIGIN
  || (process.env.VERCEL_ENV === 'production' ? 'https://simpleisrael.co.il' : `https://${process.env.VERCEL_URL}`);

/* דפדפן חדש לכל בקשה, ונסגר בסופה. ניסיון לשמור דפדפן אחד בין בקשות נתקע בבקשה
   השנייה: @sparticuz/chromium רץ ב-single-process, ועמוד שני באותו דפדפן לא נטען.
   ההפעלה עולה כשנייה, והתוצאה נשמרת במטמון, כך שזה קורה פעם אחת לכל דף. */
const launch = async () => pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('GET בלבד');
  }
  const item = resolveKey(String(req.query.k || ''));
  if (!hasSheet(item)) return res.status(404).send('אין דף לפריט הזה');
  // שני עמודים רק כשיש מסע - כמו המתג בעמוד
  const two = req.query.p === '2' && !!maps[item.id] && journeyStations(maps[item.id]).length >= 2;
  const url = `${origin()}${sheetPath(item)}${two ? '/2' : ''}`;

  let b = null;
  try {
    b = await launch();
    const page = await b.newPage();
    const r = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    if (!r || !r.ok()) throw new Error(`העמוד החזיר ${r ? r.status() : 'כלום'}`);
    // ההתאמה לעמוד רצה בעמוד עצמו (FIT_JS) ומסמנת data-fit בסיומה
    await page.waitForFunction(() => document.documentElement.dataset.fit, null, { timeout: 15000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const name = `${item.name} - ציר הזמן של עם ישראל${two ? ' (שני עמודים)' : ''}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    // filename לדפדפנים ישנים (בלי עברית), filename* לשם האמיתי
    res.setHeader('Content-Disposition', `attachment; filename="${item.kind}-${item.id}.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2592000, stale-while-revalidate=86400');
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error('sheet-pdf', url, e);
    return res.status(500).send('יצירת הקובץ נכשלה. אפשר לנסות שוב, או להשתמש ב"הדפסה" ולבחור "שמירה כ-PDF".');
  } finally {
    if (b) await b.close().catch(() => {});
  }
}
