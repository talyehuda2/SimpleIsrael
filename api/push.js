/* התראות לטלפון - הצד של הדפדפן.

   GET  /api/push            -> { key } המפתח הציבורי, שהדפדפן צריך כדי להירשם.
                               בפעם הראשונה אי פעם - נוצר זוג מפתחות (api/_lib/push.js).
   POST /api/push {endpoint, game?} -> התראת "נרשמת" למנוי שנוצר זה עתה (game - מי
                               שנרשם מהמשחק לתזכורת, ולכן הנוסח שלו). כך הגולש רואה
                               מיד שזה עובד, ואנחנו יודעים שכל השרשרת תקינה
                               (מפתחות, הצפנה, שירות ההתראות). המסד מתיר אותה
                               רק למנוי בן פחות מעשר דקות, ופעם אחת (push_welcome).

   ההרשמה עצמה (שמירת המנוי) נעשית מהדפדפן ישירות ב-RPC push_subscribe. */
import { vapid, rpc, send, secret } from './_lib/push.js';
import { sendAllowed } from '../src/lib/holy.js';

export default async function handler(req, res) {
  if (!secret()) {
    console.error('push: חסר NOTIFY_SECRET');
    return res.status(503).json({ error: 'השירות אינו זמין כרגע' });
  }
  try {
    if (req.method === 'GET') {
      const { publicKey } = await vapid();
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).json({ key: publicKey });
    }
    if (req.method === 'POST') {
      const endpoint = req.body?.endpoint;
      if (typeof endpoint !== 'string' || endpoint.length > 1000) return res.status(400).json({ error: 'בקשה לא תקינה' });
      // גם התראת "נרשמתם" לא יוצאת בשבת ובחג (src/lib/holy.js)
      if (!sendAllowed()) return res.status(200).json({ sent: false, holy: true });
      await vapid();
      const rows = await rpc('push_welcome', { p_secret: secret(), p_endpoint: endpoint });
      if (!rows?.length) return res.status(200).json({ sent: false });
      const r = await send(rows[0], req.body?.game ? {
        title: '🎯 נרשמתם לתזכורת',
        body: 'כל ערב ב-21:00 נזכיר לכם את האתגר היומי - רק אם עוד לא פתרתם אותו, ולא בשבת ובחג. שינוי וביטול: בתפריט "עוד באתר".',
        url: '/game?src=push-welcome',
        tag: 'si-welcome',
      } : {
        title: '🔔 נרשמתם להתראה היומית',
        body: 'מעכשיו תגיע מכאן דמות או אירוע מתולדות ישראל - לא בשבת ובחג. תדירות וביטול: בתפריט "עוד באתר".',
        url: '/?src=push-welcome',
        tag: 'si-welcome',
      });
      return res.status(200).json({ sent: r === 'ok' });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'GET או POST בלבד' });
  } catch (e) {
    console.error('push', e.message);
    return res.status(502).json({ error: 'שגיאה זמנית' });
  }
}
