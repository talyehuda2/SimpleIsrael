import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  server: {
    port: 5173,
    strictPort: true,
  },
});
