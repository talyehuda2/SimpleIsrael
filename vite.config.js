import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// /atlas הוא הכתובת הנקייה של מבט המסע. בפרודקשן ה-rewrite יושב ב-vercel.json;
// כאן מספקים את אותו מיפוי לשרת הפיתוח כדי שהקישורים יעבדו בשני המקומות.
const atlasAlias = {
  name: 'atlas-alias',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path, qs] = req.url.split('?');
      if (path === '/atlas' || path === '/atlas/') req.url = '/atlas.html' + (qs ? `?${qs}` : '');
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), atlasAlias],
  build: {
    // שני עמודי כניסה: ציר הזמן ומסע הדורות. כך שני המסכים חולקים את אותם
    // רכיבי React (כרטיס הפריט, המפה, התגובות) במקום שני מימושים נפרדים.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        atlas: resolve(__dirname, 'atlas.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
