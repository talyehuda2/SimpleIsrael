/* התראה יומית - הרשמה וביטול בדפדפן. השרת: api/push.js, api/push-daily.js,
   supabase/push.sql. הבאנר והתפריט: components/pushPrompt.js.

   בלי supabase-js: שתי קריאות RPC לא מצדיקות לגרור את הספרייה לכל מסך
   (אותו דפוס של game/board.js).

   אייפון: התראות אתר עובדות רק כשהאתר הותקן במסך הבית (iOS 16.4 ומעלה).
   בספארי רגיל אין PushManager כלל - ולכן iosNeedsInstall, ושם הבאנר מסביר
   איך מתקינים במקום לבקש רשות. */
import { SUPABASE_URL, SUPABASE_KEY } from './supabaseConfig.js';

export const canPush = () => typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// iOS 16.4+ בספארי רגיל: אפשר - אבל רק אחרי "הוספה למסך הבית"
export function iosNeedsInstall() {
  if (!isIos() || standalone() || canPush()) return false;
  const v = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  return !v || +v[1] > 16 || (+v[1] === 16 && +v[2] >= 4);
}

const rpc = (name, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
  method: 'POST',
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => { if (!r.ok) throw new Error(`${name} ${r.status}`); });

// המפתח הציבורי מגיע ב-base64url, ו-pushManager רוצה בייטים
const bytes = (s) => {
  const raw = atob(`${s}${'='.repeat((4 - (s.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// ציר הזמן רושם את ה-service worker בטעינה; שאר המסכים - כאן, ברגע שצריך
async function registration() {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function isSubscribed() {
  if (!canPush() || Notification.permission !== 'granted') return false;
  return !!(await currentSub().catch(() => null));
}

/** מבקש רשות ונרשם. מחזיר 'ok' | 'denied' | 'dismissed' (סגרו את החלון) | 'error' */
export async function subscribe() {
  let perm;
  try { perm = await Notification.requestPermission(); } catch { return 'error'; }
  if (perm === 'denied') return 'denied';
  if (perm !== 'granted') return 'dismissed';
  try {
    const reg = await registration();
    const { key } = await (await fetch('/api/push')).json();
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) });
    const j = sub.toJSON();
    await rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    // התראת "נרשמתם" - הוכחה מיידית שהשרשרת עובדת. כישלון בה אינו כישלון בהרשמה
    fetch('/api/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint }),
    }).catch(() => {});
    return 'ok';
  } catch {
    return 'error';
  }
}

/* התדירות (supabase/push_freq.sql). null - אין מנוי, או שהקובץ עוד לא רץ:
   אז הבחירה לא מוצגת, וכולם מקבלים כל יום */
export async function getFreq() {
  const sub = await currentSub().catch(() => null);
  if (!sub) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_get_freq`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_endpoint: sub.endpoint }),
  }).catch(() => null);
  if (!r?.ok) return null;
  return (await r.json().catch(() => null)) || null;
}

export async function setFreq(freq) {
  const sub = await currentSub().catch(() => null);
  if (!sub) return false;
  return rpc('push_set_freq', { p_endpoint: sub.endpoint, p_freq: freq }).then(() => true, () => false);
}

export async function unsubscribe() {
  const sub = await currentSub().catch(() => null);
  if (!sub) return;
  await rpc('push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
