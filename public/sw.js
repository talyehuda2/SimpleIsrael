// Service worker מינימלי: מאפשר התקנה כאפליקציה וטעינה מהירה/לא-מקוונת.
// עקרונות: HTML תמיד מהרשת קודם (כדי שלא יוצג תוכן ישן), קבצי assets עם
// חתימת-גיבוב נשמרים במטמון לתמיד, וקריאות API לעולם לא נשמרות.
const VERSION = 'si-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const KEEP = [SHELL, ASSETS];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// בקשות שלעולם לא עוברות דרך המטמון
const isBypass = (url) =>
  url.hostname.endsWith('supabase.co') ||
  url.pathname.startsWith('/_vercel') ||
  url.hostname.endsWith('vercel-insights.com');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isBypass(url)) return;                       // תגובות/אנליטיקס - תמיד רשת חיה
  if (url.origin !== self.location.origin) return; // משאבים חיצוניים (פונטים) - לדפדפן

  // ניווט/HTML: רשת קודם, ובנפילה - מהמטמון
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // קבצים עם גיבוב בשם (assets) ותמונות: מטמון קודם
  if (url.pathname.startsWith('/assets/') || /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }))
    );
  }
});

/* ---------- התראות (api/push-daily.js, api/push.js) ----------
   השרת שולח { title, body, url, image, tag }. tag קבוע להתראה היומית: אם
   ההתראה של אתמול עוד מחכה במגירה, החדשה מחליפה אותה ולא נערמת עליה. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'ציר הזמן של עם ישראל', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    image: d.image,
    tag: d.tag || 'si',
    lang: 'he',
    dir: 'rtl',
    data: { url: d.url || '/?src=push' },
  }));
});

// לחיצה: חלון פתוח של האתר עובר לכרטיס; אם אין - נפתח חלון חדש
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
    if (win) { await win.focus(); return win.navigate(url).catch(() => self.clients.openWindow(url)); }
    return self.clients.openWindow(url);
  })());
});
