import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// /atlas ו-/places הן הכתובות הנקיות של שני המבטים הנוספים. בפרודקשן
// ה-rewrite יושב ב-vercel.json; כאן מספקים את אותו מיפוי לשרת הפיתוח
// כדי שהקישורים יעבדו בשני המקומות.
const CLEAN_ROUTES = { '/atlas': '/atlas.html', '/places': '/places.html', '/admin': '/admin.html', '/game': '/game.html' };
const cleanUrls = {
  name: 'clean-urls',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path, qs] = req.url.split('?');
      const hit = CLEAN_ROUTES[path.replace(/\/$/, '')];
      if (hit) req.url = hit + (qs ? `?${qs}` : '');
      next();
    });
  },
};

/* MapLibre (המפה המודרנית במפת הארץ) מריץ worker, וברירת המחדל שלו בבאנדל היא
   worker מ-blob: - וה-CSP שלנו חוסם blob:. לכן ה-worker, הקוד המשותף שלו ותוסף
   ה-RTL מוגשים כקבצים רגילים מאותו דומיין, תחת /vendor/maplibre/, ו-modern.js
   מצביע אליהם ב-setWorkerUrl / setRTLTextPlugin. הסיומת .js ולא .mjs, כי לא כל
   שרת מגיש .mjs כ-JavaScript - ו-worker מסוג module נופל בשקט על MIME שגוי. */
const MAPLIBRE_DIST = resolve(__dirname, 'node_modules/maplibre-gl/dist');
const VENDOR = {
  'maplibre-gl-worker.js': () => readFileSync(resolve(MAPLIBRE_DIST, 'maplibre-gl-worker.mjs'), 'utf8')
    .replaceAll('./maplibre-gl-shared.mjs', './maplibre-gl-shared.js'),
  'maplibre-gl-shared.js': () => readFileSync(resolve(MAPLIBRE_DIST, 'maplibre-gl-shared.mjs'), 'utf8'),
  'rtl-text.js': () => readFileSync(resolve(__dirname, 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js'), 'utf8'),
};
const maplibreVendor = {
  name: 'maplibre-vendor',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url.match(/^\/vendor\/maplibre\/([\w.-]+)$/);
      if (!m || !VENDOR[m[1]]) return next();
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.end(VENDOR[m[1]]());
    });
  },
  generateBundle() {
    for (const [name, read] of Object.entries(VENDOR)) {
      this.emitFile({ type: 'asset', fileName: `vendor/maplibre/${name}`, source: read() });
    }
  },
};

export default defineConfig({
  plugins: [react(), cleanUrls, maplibreVendor],
  build: {
    // שלושה עמודי כניסה: ציר הזמן, מסע הדורות ומפת המקומות. שני הראשונים
    // חולקים את אותם רכיבי React (כרטיס הפריט, המפה, התגובות) במקום שני
    // מימושים נפרדים; מפת המקומות היא מסך עצמאי וקל.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        atlas: resolve(__dirname, 'atlas.html'),
        places: resolve(__dirname, 'places.html'),
        // מסך הניהול: נקודת כניסה רביעית, עצמאית לגמרי. אין לו קישור נכנס
        // מהאתר והוא חסום ב-robots.txt - הכניסה היא בהקלדת הכתובת.
        admin: resolve(__dirname, 'admin.html'),
        // המשחק "סדר את הציר": עצמאי וקל, כדי שקישור משותף ייטען מהר בטלפון
        game: resolve(__dirname, 'game.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
