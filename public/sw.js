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
  if (isBypass(url)) return;                       // תגובות/אנליטיקס — תמיד רשת חיה
  if (url.origin !== self.location.origin) return; // משאבים חיצוניים (פונטים) — לדפדפן

  // ניווט/HTML: רשת קודם, ובנפילה — מהמטמון
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
