/* ההתראה היומית: "דמות היום" לכל המנויים. מופעל מ-Cron של Vercel (vercel.json).

   מה נשלח: הפריט של היום מ-src/lib/daily.js - זהה לכולם - עם משפט או שניים
   מהתיאור, תמונת השיתוף שלו, וקישור לכרטיס בציר הזמן עם src=push (כך במסך
   הניהול רואים כמה נכנסו מההתראה).

   אין כאן בדיקת הרשאה, ובכוונה: push_claim מסמנת כל מנוי לפני השליחה, ולכן
   הפעלה נוספת באותו יום - של ה-Cron או של מישהו שמצא את הכתובת - לא שולחת
   כלום. מנוי ששירות ההתראות אמר שבוטל (404/410) נמחק. */
import { vapid, rpc, send, secret, SITE } from './_lib/push.js';
import { dailyItem, teaser, dailyLabel } from '../src/lib/daily.js';
import { israelDay } from '../src/game/pool.js';

const BATCH = 500;

export default async function handler(req, res) {
  if (!secret()) return res.status(503).json({ error: 'חסר NOTIFY_SECRET' });
  const day = israelDay();
  const it = dailyItem(day);
  const payload = {
    title: `${dailyLabel(it)}: ${it.name}`,
    body: teaser(it.description),
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
      const subs = await rpc('push_claim', { p_secret: secret(), p_day: day, p_limit: BATCH });
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
    console.log('push-daily', day, it.kind, it.id, { sent, gone, failed });
    return res.status(200).json({ day, item: `${it.kind}:${it.id}`, sent, gone, failed });
  } catch (e) {
    console.error('push-daily', e.message);
    return res.status(502).json({ error: 'שגיאה זמנית' });
  }
}
