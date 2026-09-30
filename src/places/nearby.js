/* "איפה אני" במפת הארץ - הצעה של גולש (אריאל): לעמוד במקום וללמוד עליו
   ועל סביבתו.

   המיקום אינו יוצא מהמכשיר. הוא מתקבל מהדפדפן, המרחקים מחושבים כאן,
   ושום קואורדינטה אינה נשלחת, נשמרת או נרשמת במדידה - רק שהכפתור הופעל
   ומה יצא. זה כתוב גם בעמוד הפרטיות, ולכן לא לשנות בלי לעדכן גם שם.

   מגבלה שכדאי לזכור: המפה מצוירת, ורוב הזיהויים של מקומות עתיקים
   משוערים. זה כלי ל"מה קרה כאן בסביבה", לא לניווט עד האבן. */
import { MAP_SIZE, projectRaw } from '../utils/mapProject.js';

// מעבר לזה הגולש אינו "ליד" שום מקום באתר, גם אם הוא בתוך מסגרת המפה
// (למשל בלב סיני). 40 ק"מ מכסים כל נקודה בארץ: הפער הגדול ביותר בין
// יישוב לבין המקום הקרוב אליו ברשימה קטן מזה.
export const MAX_KM = 40;
export const NEAR_COUNT = 5;

/** מרחק על הכדור בק"מ (haversine) */
export function km(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* "מיקום מקורב" (מצרים, בבל, חרן...) נשאר מחוץ לחישוב: הנקודה שלהם על
   המפה מציינת כיוון ולא מקום, ומרחק אליה היה שקר. */
export function nearest(places, lat, lon, n = NEAR_COUNT) {
  return places
    .filter((p) => p.lat != null && !p.approx)
    .map((p) => ({ p, km: km(lat, lon, p.lat, p.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

/** מיקום הגולש על המפה, או null אם הוא מחוץ למסגרת */
export function locateOnMap(lat, lon) {
  const q = projectRaw(lon, lat);
  if (q.x < 0 || q.y < 0 || q.x > MAP_SIZE || q.y > MAP_SIZE) return null;
  return q;
}

/** כמה פיקסלים של המפה הם ק"מ אחד סביב נקודה - לעיגול הדיוק */
export function pxPerKm(lat, lon) {
  const a = projectRaw(lon, lat), b = projectRaw(lon, lat + 0.05);
  return Math.hypot(b.x - a.x, b.y - a.y) / km(lat, lon, lat + 0.05, lon);
}

export const fmtKm = (d) => (d < 1 ? `${Math.round(d * 1000 / 50) * 50} מ׳` : `${d < 10 ? d.toFixed(1) : Math.round(d)} ק״מ`);

/** עוטף את getCurrentPosition בהבטחה, עם שגיאה בשם שהממשק מבין */
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
