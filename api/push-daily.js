/* ההתראה היומית: "דמות היום" לכל המנויים. מופעל מ-Cron של Vercel (vercel.json):
   בכל ערב חוץ משישי ב-21:00 שעון ישראל (בהחלטת בעל האתר, אוקטובר 2026 - קודם 19:00/20:00),
   ובשישי בצהריים (עד 15:00) - כי לעולם לא שולחים בשבת ובחג (src/lib/holy.js). הבדיקה
   כאן, בכל הפעלה, ולא רק בשעות ה-Cron: הפעלה באיחור או ידנית לא תשלח בשבת.

   21:00 בדיוק כל השנה: ה-Cron של Vercel הוא UTC ואינו יודע על שעון קיץ, ולכן slot=evening
   מופעל פעמיים, ב-18 וב-19 UTC, ושולח רק בהפעלה שבה השעה בישראל היא 21 (בקיץ הראשונה,
   בחורף השנייה). push_claim מבטיחה ממילא שאף אחד לא יקבל פעמיים.

   רק למי שהתדירות שלו "בתור" היום (כל יום / יום כן יום לא / פעמיים / פעם בשבוע).

   מה נשלח: הפריט של היום מ-src/lib/daily.js - זהה לכולם; בשישי מפרשת השבוע,
   ובחג מהחג, ואז שורת "למה" מעל - עם משפט או שניים מהתיאור, תמונת השיתוף שלו, וקישור לכרטיס בציר הזמן עם src=push (כך במסך
   הניהול רואים כמה נכנסו מההתראה).

   אין כאן בדיקת הרשאה, ובכוונה: push_claim מסמנת כל מנוי לפני השליחה, ולכן
   הפעלה נוספת באותו יום - של ה-Cron או של מישהו שמצא את הכתובת - לא שולחת
   כלום. מנוי ששירות ההתראות אמר שבוטל (404/410) נמחק. */
import { vapid, rpc, send, secret, SITE } from './_lib/push.js';
import { dailyPick, teaser } from '../src/lib/daily.js';
import { israelDay } from '../src/game/pool.js';
import { sendAllowed, freqsDue, israelNow } from '../src/lib/holy.js';

const BATCH = 500;

/* push_claim_due (supabase/push_freq.sql) מסננת לפי תדירות. עד שהקובץ רץ היא לא
   קיימת - ואז כולם "כל יום", בפונקציה הקודמת */
async function claim(day, due) {
  try {
    return await rpc('push_claim_due', { p_secret: secret(), p_day: day, p_freqs: due, p_limit: BATCH });
  } catch (e) {
    if (!/PGRST202| 404 /.test(e.message)) throw e;
    return rpc('push_claim', { p_secret: secret(), p_day: day, p_limit: BATCH });
  }
}

export default async function handler(req, res) {
  if (!secret()) return res.status(503).json({ error: 'חסר NOTIFY_SECRET' });
  if (!sendAllowed()) return res.status(200).json({ skipped: 'שבת או חג' });
  if (req.query?.slot === 'evening' && israelNow().hour !== 21) {
    return res.status(200).json({ skipped: 'לא 21:00 בישראל - ההפעלה השנייה תשלח' });
  }
  const day = israelDay();
  const due = freqsDue(day);
  const { it, title, why } = dailyPick(day);
  const payload = {
    title,
    body: why ? `${why}\n${teaser(it.description, 100)}` : teaser(it.description),
    url: `/?sel=${it.kind}:${it.id}&src=push`,
    image: `${SITE}/og/${it.kind}/${it.id}.jpg`,
    tag: 'si-daily',
  };
  try {
    await vapid();
    let sent = 0, gone = 0, failed = 0;
    // סבבים של 500 עד שהתור של היום ריק. מנוי שסומן ונכשל (תקלה זמנית בשירות
    // ההתראות) מפספס את היום הזה - עדיף על פני סיכון לשלוח לאחרים פעמיים
    for (let round = 0; round < 20; round++) {
      const subs = await claim(day, due);
      if (!subs?.length) break;
      const results = [];
      for (let i = 0; i < subs.length; i += 25) {
        results.push(...await Promise.all(subs.slice(i, i + 25).map((s) => send(s, payload))));
      }
      const dead = subs.filter((_, i) => results[i] === 'gone').map((s) => s.endpoint);
      if (dead.length) await rpc('push_gone', { p_secret: secret(), p_endpoints: dead });
      sent += results.filter((r) => r === 'ok').length;
      gone += dead.length;
      failed += results.filter((r) => r === 'fail').length;
      if (subs.length < BATCH) break;
    }
    console.log('push-daily', day, it.kind, it.id, due, { sent, gone, failed });
    return res.status(200).json({ day, item: `${it.kind}:${it.id}`, due, sent, gone, failed });
  } catch (e) {
    console.error('push-daily', e.message);
    return res.status(502).json({ error: 'שגיאה זמנית' });
  }
}
