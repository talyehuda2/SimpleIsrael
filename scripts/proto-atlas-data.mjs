// מחולל נתונים לאב-הטיפוס "אטלס הדורות" (public/proto-atlas.html).
// שולף דמויות + מסעות מנתוני האתר וכותב public/proto-data.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'src', 'data', f), 'utf8'));

const maps = read('maps.json');
const leaders = read('leaders.json');
const kings = read('kings.json');
const events = read('events.json');

// ===== היטל למפה המרובעת (israel_map_square.png, 1254x1254) =====
// הציור החדש אינו עקבי-אפינית (הצפון "הוזז" אמנותית), לכן: affine בסיסי
// מריבועים-פחותים + תיקון שאריות IDW שמדויק בכל 11 עוגני הערים שזוהו בתמונה.
const ANCHORS = [
  // [lon, lat, pxX, pxY] — נקודות הערים שזוהו על israel_map_square2.png
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
const affine = (lon, lat) => ({ X: AFF.ax * lon + AFF.bx * lat + AFF.cx, Y: AFF.ay * lon + AFF.by * lat + AFF.cy });
const RES = ANCHORS.map(([lon, lat, px, py]) => {
  const a = affine(lon, lat);
  return { lon, lat, rx: px - a.X, ry: py - a.Y };
});
const IMG2 = 1254;
const proj2 = (lon, lat) => {
  const a = affine(lon, lat);
  let sw = 0, sx = 0, sy = 0;
  for (const r of RES) {
    const d2 = (lon - r.lon) ** 2 + (lat - r.lat) ** 2;
    const w = 1 / (d2 + 0.0004);
    sw += w; sx += w * r.rx; sy += w * r.ry;
  }
  return {
    X: Math.max(16, Math.min(IMG2 - 16, a.X + sx / sw)),
    Y: Math.max(16, Math.min(IMG2 - 16, a.Y + sy / sw)),
  };
};
// נקודות שהוצבו ידנית בפיקסלים של המפה הישנה: היפוך ההיטל הישן -> lat/lon -> היטל חדש
const DET = 226.10 * -311.53 - 21.00 * -38.05;
const oldToLatLon = (X, Y) => {
  const u = X + 8226.5, v = Y - 11836.5;
  return { lon: (-311.53 * u + -21.00 * v) / DET, lat: (38.05 * u + 226.10 * v) / DET };
};
const projX = null, projY = null; // הוחלפו ב-proj2 (שומר שלא ישתמשו בטעות)

const pool = [...leaders, ...kings.united, ...kings.judah, ...kings.israel];
const fig = (id) => pool.find((x) => x.id === id);
const ev = (id) => events.find((x) => x.id === id);

const KIND = { avraham:'מנהיג', sarah:'מנהיגה', yitzchak:'מנהיג', yaakov:'מנהיג', yosef:'מנהיג',
  moshe:'מנהיג', aharon:'מנהיג', miriam:'מנהיגה', 'yehoshua-l':'מנהיג',
  shaul:'מלך — הממלכה המאוחדת', david:'מלך — הממלכה המאוחדת', shlomo:'מלך — הממלכה המאוחדת' };

const figCard = (id) => {
  const f = fig(id);
  const m = maps[id];
  return {
    id, name: f.name, kind: KIND[id] || 'דמות',
    desc: f.description || '', verse: f.verse || null, vref: f.verseRef || null, src: f.source || null,
    sub: `${f.start}–${f.end}` + (f.lifeText ? ` · ${f.lifeText}` : f.reignText ? ` · ${f.reignText}` : ''),
    map: m ? {
      title: m.title,
      points: (m.points || []).sort((a, b) => a.order - b.order).map((p) => {
        const ll = p.x != null ? oldToLatLon(p.x, p.y) : { lon: p.lon, lat: p.lat };
        const q = proj2(ll.lon, ll.lat);
        return { n: p.order, name: p.name, label: p.label, desc: p.desc, X: +q.X.toFixed(1), Y: +q.Y.toFixed(1) };
      }),
    } : null,
  };
};
const evCard = (id) => {
  const e = ev(id);
  return { id, name: e.name, kind: 'אירוע', sub: `אירוע · ${e.year}`,
    desc: e.description || '', verse: e.verse || null, vref: e.verseRef || null, src: e.source || null, map: null };
};

const data = {
  eras: [
    { title: 'תקופת האבות', verse: '„לך לך מארצך”',
      cards: ['avraham', 'sarah', 'yitzchak', 'yaakov'].map(figCard).concat([evCard('akeida')], ['yosef'].map(figCard)) },
    { title: 'יציאת מצרים והמדבר', verse: '„בכוחו הגדול ממצרים”',
      cards: ['moshe', 'aharon', 'miriam', 'yehoshua-l'].map(figCard) },
    { title: 'ראשית המלוכה', verse: '„שום תשים עליך מלך”',
      cards: ['shaul', 'david', 'shlomo'].map(figCard) },
  ],
};
// העקידה אחרי שרה (כרונולוגית 2085 — מות שרה בשנת העקידה)
const avot = data.eras[0].cards;
const ak = avot.splice(avot.findIndex((c) => c.id === 'akeida'), 1)[0];
avot.splice(2, 0, ak);

writeFileSync(join(ROOT, 'public', 'proto-data.json'), JSON.stringify(data), 'utf8');
const n = data.eras.reduce((s, e) => s + e.cards.length, 0);
console.log('proto-data.json:', data.eras.length, 'תקופות,', n, 'כרטיסים,',
  data.eras.flatMap(e => e.cards).filter(c => c.map).length, 'עם מפה');
