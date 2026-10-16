/* משותף ל-api/push.js ול-api/push-daily.js: מפתחות VAPID, קריאות למסד ושליחה.

   המפתחות נוצרים כאן בפעם הראשונה שמישהו מבקש אותם, ונשמרים ב-Postgres
   (push_keys_get, supabase/push.sql) - כך המפתח הפרטי לא עובר בצ'אט, לא
   בקוד ולא במשתני הסביבה של Vercel. שתי קריאות ראשונות במקביל: המסד שומר
   את הראשונה ומחזיר אותה לשתיהן (on conflict do nothing).

   הגישה למסד: RPC עם המפתח הציבורי ועם NOTIFY_SECRET, אותו דפוס של
   api/game.js. אין SUPABASE_SERVICE_KEY.

   משתני סביבה (Vercel בלבד): NOTIFY_SECRET - כבר מוגדר בשביל api/notify.js */
import webpush from 'web-push';
import { SUPABASE_URL, SUPABASE_KEY } from '../../src/lib/supabaseConfig.js';

export const SITE = 'https://simpleisrael.co.il';
export const secret = () => process.env.NOTIFY_SECRET;

export async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name} ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

let keys = null;
export async function vapid() {
  if (keys) return keys;
  let rows = await rpc('push_keys_get', { p_secret: secret() });
  if (!rows?.length) {
    const fresh = webpush.generateVAPIDKeys();
    rows = await rpc('push_keys_get', { p_secret: secret(), p_pub: fresh.publicKey, p_priv: fresh.privateKey });
  }
  keys = { publicKey: rows[0].pub, privateKey: rows[0].priv };
  webpush.setVapidDetails('mailto:noreply@simpleisrael.co.il', keys.publicKey, keys.privateKey);
  return keys;
}

/* שליחה למנוי אחד. מחזיר 'ok', 'gone' (המנוי בוטל בדפדפן - למחוק) או 'fail'.
   TTL של 12 שעות: טלפון כבוי שנדלק למחרת לא יקבל את "דמות היום" של אתמול. */
export async function send(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 12 * 3600, urgency: 'normal', topic: 'si-daily' },
    );
    return 'ok';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return 'gone';
    console.error('push send', e.statusCode, String(e.body || e.message).slice(0, 200));
    return 'fail';
  }
}
