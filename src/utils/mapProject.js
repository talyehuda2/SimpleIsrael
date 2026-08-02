/* היטל תחנות המסע אל israel_map_square2.png (1254x1254).
   מקור אמת יחיד: גם ציר הזמן וגם מסע הדורות מקרינים דרך כאן, וכך אותה
   תחנה נוחתת בשני המסכים על אותו פיקסל בדיוק.

   הציור אינו עקבי-אפינית (הצפון "הוזז" אמנותית), ולכן ההיטל בנוי משני
   שלבים: אפיני בסיסי שהותאם בריבועים-פחותים, ומעליו תיקון שאריות IDW
   שמאפס את השגיאה ב-11 עוגני הערים שזוהו בתמונה. */

export const MAP_SRC = '/israel_map_square2.png';
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

/** lat/lon -> פיקסלים על המפה המרובעת */
export function project(lon, lat) {
  const a = affine(lon, lat);
  let sw = 0, sx = 0, sy = 0;
  for (const r of RES) {
    const d2 = (lon - r.lon) ** 2 + (lat - r.lat) ** 2;
    const w = 1 / (d2 + 0.0004);
    sw += w; sx += w * r.rx; sy += w * r.ry;
  }
  return {
    x: Math.max(16, Math.min(MAP_SIZE - 16, a.X + sx / sw)),
    y: Math.max(16, Math.min(MAP_SIZE - 16, a.Y + sy / sw)),
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

/** תחנות המסע של פריט, ממוינות, עם פיקסלים ואורך מצטבר לאורך המסלול */
export function journeyStations(mapEntry) {
  if (!mapEntry || !mapEntry.points) return [];
  const pts = mapEntry.points.slice().sort((a, b) => a.order - b.order).map((p) => {
    const ll = p.x != null ? oldPixelToLatLon(p.x, p.y) : { lon: p.lon, lat: p.lat };
    const q = project(ll.lon, ll.lat);
    return { ...p, x: q.x, y: q.y };
  });
  let total = 0;
  pts.forEach((p, i) => {
    if (i > 0) total += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    p.cum = total;
  });
  return pts;
}
