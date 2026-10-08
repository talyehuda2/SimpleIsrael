/* היטל תחנות המסע אל israel_map_square2.png (1254x1254).
   מקור אמת יחיד: גם ציר הזמן וגם מסע הדורות מקרינים דרך כאן, וכך אותה
   תחנה נוחתת בשני המסכים על אותו פיקסל בדיוק.

   הציור אינו עקבי-אפינית (הצפון "הוזז" אמנותית), ולכן ההיטל בנוי משני
   שלבים: אפיני בסיסי שהותאם בריבועים-פחותים, ומעליו תיקון שאריות IDW
   שמאפס את השגיאה ב-11 עוגני הערים שזוהו בתמונה. */

import { offMapDir, offMapLat } from './placeNote.js';

/* ?v= משתנה בכל עריכה של התמונה, אחרת דפדפן שכבר טען אותה ממשיך להציג
   את הישנה. v=2 (אוקטובר 2026): הכיתוב "מצרים" שצויר על חצי האי סיני
   הוחלף ב"מדבר סיני" - גולש העיר שסיני אינו מצרים, ובצדק */
export const MAP_SRC = '/israel_map_square2.png?v=2';
export const MAP_SIZE = 1254;

// [lon, lat, pxX, pxY] - מרכזי נקודות הערים שזוהו על התמונה
const ANCHORS = [
  [35.652, 33.249, 823.6, 68.0],   // דן
  [35.194, 33.270, 675.2, 197.1],  // צור
  [35.28, 32.21, 694.2, 473.0],    // שכם
  [35.29, 32.06, 694.5, 539.0],    // שילה
  [35.22, 31.78, 670.9, 606.2],    // ירושלים
  [34.65, 31.80, 552.0, 615.8],    // אשדוד
  [35.20, 31.705, 660.6, 654.2],   // בית לחם
  [34.57, 31.67, 528.2, 665.0],    // אשקלון
  [35.10, 31.53, 616.9, 721.9],    // חברון
  [34.47, 31.53, 475.1, 729.4],    // עזה
  [34.79, 31.25, 581.9, 798.1],    // באר שבע
];

const AFF = { ax: 236.779, bx: 18.618, cx: -8258.2, ay: -53.074, by: -316.626, cy: 12544.8 };
const affine = (lon, lat) => ({
  X: AFF.ax * lon + AFF.bx * lat + AFF.cx,
  Y: AFF.ay * lon + AFF.by * lat + AFF.cy,
});

const RES = ANCHORS.map(([lon, lat, px, py]) => {
  const a = affine(lon, lat);
  return { lon, lat, rx: px - a.X, ry: py - a.Y };
});

/** lat/lon -> פיקסלים, בלי הצמדה לשולי המפה. "איפה אני" צריך לדעת שהגולש
    מחוץ למסגרת, ולא לקבל נקודה תקועה בקצה. */
export function projectRaw(lon, lat) {
  const a = affine(lon, lat);
  let sw = 0, sx = 0, sy = 0;
  for (const r of RES) {
    const d2 = (lon - r.lon) ** 2 + (lat - r.lat) ** 2;
    const w = 1 / (d2 + 0.0004);
    sw += w; sx += w * r.rx; sy += w * r.ry;
  }
  return { x: a.X + sx / sw, y: a.Y + sy / sw };
}

/** פיקסלים -> lat/lon: ההיפוך של projectRaw. לתיקון השאריות אין נוסחה הפוכה,
    ולכן ניוטון עם יעקוביאן מספרי, מנקודת פתיחה של האפיני ההפוך. שלוש-ארבע
    איטרציות מספיקות לדיוק של שבריר פיקסל. משמש את המעבר בין המפה העתיקה
    למודרנית, כדי שאותו אזור יישאר במבט. */
export function unprojectRaw(x, y) {
  const det = AFF.ax * AFF.by - AFF.bx * AFF.ay;
  let lon = (AFF.by * (x - AFF.cx) - AFF.bx * (y - AFF.cy)) / det;
  let lat = (-AFF.ay * (x - AFF.cx) + AFF.ax * (y - AFF.cy)) / det;
  const h = 1e-4;
  for (let i = 0; i < 8; i++) {
    const p = projectRaw(lon, lat);
    const ex = p.x - x, ey = p.y - y;
    if (Math.abs(ex) + Math.abs(ey) < 0.01) break;
    const pl = projectRaw(lon + h, lat), pt = projectRaw(lon, lat + h);
    const a = (pl.x - p.x) / h, b = (pt.x - p.x) / h, c = (pl.y - p.y) / h, d = (pt.y - p.y) / h;
    const dd = a * d - b * c;
    lon -= (d * ex - b * ey) / dd;
    lat -= (-c * ex + a * ey) / dd;
  }
  return { lon, lat };
}

/** lat/lon -> פיקסלים על המפה המרובעת */
export function project(lon, lat) {
  const q = projectRaw(lon, lat);
  return {
    x: Math.max(16, Math.min(MAP_SIZE - 16, q.x)),
    y: Math.max(16, Math.min(MAP_SIZE - 16, q.y)),
  };
}

/* נקודות ותיקות הוצבו ידנית בפיקסלים של המפה הישנה (820x1231). כדי לא
   לאבד את המיקום הידני, הופכים אותן חזרה ל-lat/lon דרך ההיטל הישן ואז
   מקרינים למפה החדשה. */
const OLD = { ax: 226.10, bx: 21.00, cx: -8226.5, ay: -38.05, by: -311.53, cy: 11836.5 };
const DET = OLD.ax * OLD.by - OLD.bx * OLD.ay;
export const oldPixelToLatLon = (x, y) => ({
  lon: (OLD.by * (x - OLD.cx) - OLD.bx * (y - OLD.cy)) / DET,
  lat: (-OLD.ay * (x - OLD.cx) + OLD.ax * (y - OLD.cy)) / DET,
});

/* מקום מחוץ למסגרת (מצרים, בבל, חרן...) נדחף לשולי המפה בצד שלו, ומשם
   מצויר כחץ החוצה. קודם הוא נחת היכן שההיטל קיצץ אותו - מצרים על החוף
   הצפוני של סיני - והמפה טענה בכך שסיני הוא מצרים. EDGE משאיר את העיגול
   (רדיוס 16) ואת החץ שמעבר לו בתוך התמונה. */
const EDGE = 44;

/* הגובה בשולי המפה שבו עובר קו הרוחב lat. הציור מסובב מעט, ולכן לא
   מספיק y של ההיטל במקום עצמו - מחפשים (חיפוש בינארי) את הנקודה על קו
   השוליים x שקו הרוחב שלה הוא lat. מחוץ לטווח - נצמד לפינה. */
function edgeYForLat(x, lat) {
  let lo = EDGE, hi = MAP_SIZE - EDGE;
  if (unprojectRaw(x, hi).lat >= lat) return hi;
  if (unprojectRaw(x, lo).lat <= lat) return lo;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (unprojectRaw(x, mid).lat > lat) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function toEdge(q, dir, lat) {
  if (dir === 'w') return { x: EDGE, y: lat != null ? edgeYForLat(EDGE, lat) : q.y };
  if (dir === 'e') return { x: MAP_SIZE - EDGE, y: lat != null ? edgeYForLat(MAP_SIZE - EDGE, lat) : q.y };
  if (dir === 'n') return { x: q.x, y: EDGE };
  if (dir === 's') return { x: q.x, y: MAP_SIZE - EDGE };
  return q;
}

/** סמן "מחוץ למפה": העיגול עצמו מקבל חוד קטן החוצה, כמו סיכת מפה שהוטתה על
    צדה - צורה אחת ולא עיגול וחץ. קודם החץ היה צורה נפרדת בגודל קבוע, ועל
    מקום קטן הוא יצא כפול מהנקודה והיה הדבר הראשון שהעין ראתה (הערת בעל
    האתר, אוקטובר 2026). החוד בולט 0.4 מהרדיוס, בין min ל-max, ולכן תמיד קטן
    מהעיגול. הצלעות משיקות לעיגול (α = acos(r/D)), כך שאין שבר בחיבור.
    משותף לציר הזמן, למסע הדורות, למפת הארץ ולתמונות השיתוף. */
export function offMapPin(x, y, dir, r, min = 3.5, max = 7) {
  const th = { w: Math.PI, e: 0, n: -Math.PI / 2, s: Math.PI / 2 }[dir] ?? 0;
  const D = r + Math.min(max, Math.max(min, 0.4 * r));
  const a = Math.acos(r / D);
  const P = (t, d = r) => `${(x + d * Math.cos(t)).toFixed(1)},${(y + d * Math.sin(t)).toFixed(1)}`;
  return `M${P(th + a)} A${r.toFixed(1)},${r.toFixed(1)} 0 1 1 ${P(th - a)} L${P(th, D)} Z`;
}

/** מיקום שם המקום ליד סמן "מחוץ למפה" ברדיוס r - בצד הפנימי, כי הסמן צמוד
    לשוליים ושם ממורכז היה נחתך בקצה התמונה. anchor מניח direction="rtl":
    ‏end הוא הקצה השמאלי, ולכן במערב השם נמתח ימינה מהעיגול. */
export function offMapMark(x, y, dir, r = 16) {
  return {
    label: dir === 'w' ? { x: x + r * 1.5, y: y + r * 0.4, anchor: 'end' }
      : dir === 'e' ? { x: x - r * 1.5, y: y + r * 0.4, anchor: 'start' }
      : dir === 'n' ? { x, y: y + r * 2.6, anchor: 'middle' }
      : { x, y: y - r * 1.75, anchor: 'middle' },
  };
}

/** תחנות המסע של פריט, ממוינות, עם פיקסלים ואורך מצטבר לאורך המסלול.
    לתחנה מחוץ למסגרת נוסף off - הצד של המפה (ראו placeNote.js) */
export function journeyStations(mapEntry) {
  if (!mapEntry || !mapEntry.points) return [];
  const pts = mapEntry.points.slice().sort((a, b) => a.order - b.order).map((p) => {
    const ll = p.x != null ? oldPixelToLatLon(p.x, p.y) : { lon: p.lon, lat: p.lat };
    const off = offMapDir(p.name);
    const q = toEdge(project(ll.lon, ll.lat), off, offMapLat(p.name));
    // lat/lon נשמרים למפה המודרנית של המסע, שמציירת על קואורדינטות ולא על הציור
    return { ...p, x: q.x, y: q.y, lat: ll.lat, lon: ll.lon, ...(off ? { off } : {}) };
  });
  let total = 0;
  pts.forEach((p, i) => {
    if (i > 0) total += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    p.cum = total;
  });
  return pts;
}
