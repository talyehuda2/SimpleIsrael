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

/** מבקש רשות ונרשם. game - נרשם מהמשחק: תזכורת לאתגר, בלי דמות יומית (אפשר להוסיף
    אחר כך בתפריט). מחזיר 'ok' | 'denied' | 'dismissed' (סגרו את החלון) | 'error' */
export async function subscribe({ game = false } = {}) {
  let perm;
  try { perm = await Notification.requestPermission(); } catch { return 'error'; }
  if (perm === 'denied') return 'denied';
  if (perm !== 'granted') return 'dismissed';
  try {
    const reg = await registration();
    const { key } = await (await fetch('/api/push')).json();
    const had = await reg.pushManager.getSubscription();
    const sub = had || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) });
    const j = sub.toJSON();
    await rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    // מנוי קיים שומר על הדמות היומית שבחר; חדש מהמשחק - רק תזכורת
    if (game) await setPrefs(had ? { game: true } : { freq: 'none', game: true });
    // התראת "נרשמתם" - הוכחה מיידית שהשרשרת עובדת. כישלון בה אינו כישלון בהרשמה
    fetch('/api/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, game }),
    }).catch(() => {});
    return 'ok';
  } catch {
    return 'error';
  }
}

const post = (name, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
  method: 'POST',
  headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).catch(() => null);

/* ההעדפות: { freq, game }. null - אין מנוי, או שהקבצים עוד לא רצו. בלי push_game.sql
   יש רק freq (push_freq.sql), ו-game הוא null - ואז שורת התזכורת לא מוצגת. בלי שניהם
   גם הבחירה לא מוצגת, וכולם מקבלים כל יום */
export async function getPrefs() {
  const sub = await currentSub().catch(() => null);
  if (!sub) return null;
  let r = await post('push_get_prefs', { p_endpoint: sub.endpoint });
  if (r?.ok) {
    const j = await r.json().catch(() => null);
    if (j) setGameFlag(j.game);
    return j;
  }
  r = await post('push_get_freq', { p_endpoint: sub.endpoint });
  const freq = r?.ok ? await r.json().catch(() => null) : null;
  return freq ? { freq, game: null } : null;
}

export async function setPrefs(prefs) {
  const sub = await currentSub().catch(() => null);
  if (!sub) return false;
  let ok = await rpc('push_set_prefs', { p_endpoint: sub.endpoint, p_freq: prefs.freq ?? null, p_game: prefs.game ?? null })
    .then(() => true, () => false);
  // עד ש-push_game.sql רץ - התדירות דרך הפונקציה הקודמת
  if (!ok && prefs.freq && prefs.game == null) {
    ok = await rpc('push_set_freq', { p_endpoint: sub.endpoint, p_freq: prefs.freq }).then(() => true, () => false);
  }
  if (ok && prefs.game != null) setGameFlag(prefs.game);
  return ok;
}

/* "שיחקתי היום" - כדי שמי שכבר פתר לא יקבל תזכורת. הדגל במכשיר רק חוסך קריאה למי
   שלא ביקש תזכורת (כמעט כולם); המסד ממילא מתעלם ממי שאין לו game */
const FLAG = 'si_push_game';
function setGameFlag(on) { try { if (on) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch { /* מתעלמים */ } }
export async function markPlayed(day) {
  try { if (localStorage.getItem(FLAG) !== '1') return; } catch { return; }
  const sub = await currentSub().catch(() => null);
  if (sub) post('push_game_played', { p_endpoint: sub.endpoint, p_day: day });
}

// push_game.sql רץ? פונקציה קיימת מחזירה 200 גם בלי מנוי; חסרה - 404
export const gameReady = () => post('push_get_prefs', { p_endpoint: '' }).then((r) => !!r?.ok);

export async function unsubscribe() {
  const sub = await currentSub().catch(() => null);
  if (!sub) return;
  await rpc('push_unsubscribe', { p_endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  setGameFlag(false);
}
