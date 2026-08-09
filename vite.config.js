import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// /atlas ו-/places הן הכתובות הנקיות של שני המבטים הנוספים. בפרודקשן
// ה-rewrite יושב ב-vercel.json; כאן מספקים את אותו מיפוי לשרת הפיתוח
// כדי שהקישורים יעבדו בשני המקומות.
const CLEAN_ROUTES = { '/atlas': '/atlas.html', '/places': '/places.html' };
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

export default defineConfig({
  plugins: [react(), cleanUrls],
  build: {
    // שלושה עמודי כניסה: ציר הזמן, מסע הדורות ומפת המקומות. שני הראשונים
    // חולקים את אותם רכיבי React (כרטיס הפריט, המפה, התגובות) במקום שני
    // מימושים נפרדים; מפת המקומות היא מסך עצמאי וקל.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        atlas: resolve(__dirname, 'atlas.html'),
        places: resolve(__dirname, 'places.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
