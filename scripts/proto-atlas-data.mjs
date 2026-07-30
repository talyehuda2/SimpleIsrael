// מחולל נתונים לאב-הטיפוס "אטלס הדורות" (public/proto-atlas.html).
// מייצא את כל פריטי האתר מקובצים לפי תקופה, יחד עם אילן היוחסין ותובנות
// מחושבות מראש — כדי שהאב-טיפוס יהיה עצמאי (vanilla JS, בלי React).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genealogy } from '../src/data/genealogy.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(ROOT, 'src', 'data', f), 'utf8'));

const maps = read('maps.json');
const leaders = read('leaders.json');
const judges = read('judges.json');
const kings = read('kings.json');
const prophets = read('prophets.json');
const books = read('books.json');
const world = read('world.json');
const events = read('events.json');
const periods = read('periods.json');

// ===== היטל למפה המרובעת (israel_map_square2.png, 1254x1254) =====
// הציור אינו עקבי-אפינית (הצפון "הוזז" אמנותית), לכן: affine בסיסי
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
const oldToLatLon = (X, Y) => ({
  lon: (-311.53 * (X + 8226.5) + -21.00 * (Y - 11836.5)) / DET,
  lat: (38.05 * (X + 8226.5) + 226.10 * (Y - 11836.5)) / DET,
});

const mapOf = (id) => {
  const m = maps[id];
  if (!m) return null;
  return {
    title: m.title,
    points: (m.points || []).slice().sort((a, b) => a.order - b.order).map((p) => {
      const ll = p.x != null ? oldToLatLon(p.x, p.y) : { lon: p.lon, lat: p.lat };
      const q = proj2(ll.lon, ll.lat);
      return { n: p.order, name: p.name, label: p.label, desc: p.desc, X: +q.X.toFixed(1), Y: +q.Y.toFixed(1) };
    }),
  };
};

// ===== איסוף כל הפריטים =====
const KINDS = {
  leader: { label: 'מנהיג', layer: 'leaders' },
  judge: { label: 'שופט', layer: 'judges' },
  united: { label: 'מלך — הממלכה המאוחדת', layer: 'kings' },
  judah: { label: 'מלך יהודה', layer: 'kings' },
  israel: { label: 'מלך ישראל', layer: 'kings' },
  prophet: { label: 'נביא', layer: 'prophets' },
  book: { label: 'ספר תנ״ך', layer: 'books' },
  event: { label: 'אירוע', layer: 'events' },
  world: { label: 'רקע עולמי', layer: 'world' },
};

const item = (x, kind) => {
  const meta = [];
  if (x.reignText) meta.push('👑 ' + x.reignText);
  if (x.lifeText) meta.push('⏳ ' + x.lifeText);
  if (x.tenureText) meta.push('⚖️ ' + x.tenureText);
  if (x.kings) meta.push('🤝 בימי ' + x.kings);
  if (x.empire) meta.push('🌍 ' + x.empire);
  return {
    id: x.id, kind, kindLabel: KINDS[kind].label, layer: KINDS[kind].layer,
    name: x.name, start: x.start, end: x.end,
    approx: !!x.approxDates,
    judgment: x.judgment || null,
    meta,
    desc: x.description || '',
    verse: x.verse || null, vref: x.verseRef || null, src: x.source || null,
    map: mapOf(x.id),
  };
};

const all = [
  ...leaders.map((x) => item(x, 'leader')),
  ...judges.map((x) => item(x, 'judge')),
  ...kings.united.map((x) => item(x, 'united')),
  ...kings.judah.map((x) => item(x, 'judah')),
  ...kings.israel.map((x) => item(x, 'israel')),
  ...prophets.map((x) => item(x, 'prophet')),
  ...books.map((x) => item(x, 'book')),
  ...world.map((x) => item(x, 'world')),
  ...events.map((x) => item({ ...x, start: x.year, end: x.year }, 'event')),
];

// ===== קיבוץ לפי תקופה (לפי שנת ההתחלה) =====
const sortedPeriods = [...periods].sort((a, b) => a.start - b.start);
const periodOf = (it) =>
  sortedPeriods.find((p) => it.start >= p.start && it.start < p.end)
  || sortedPeriods.find((p) => it.start >= p.start && it.start <= p.end)
  || sortedPeriods[sortedPeriods.length - 1];

// פסוק פותח לכל תקופה — מן הפריט הראשון בה שיש לו פסוק
const eras = sortedPeriods.map((p) => {
  const list = all.filter((it) => periodOf(it).id === p.id)
    .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name, 'he'));
  return { id: p.id, title: p.name, start: p.start, end: p.end, items: list };
}).filter((e) => e.items.length);

// ===== תובנות (אותם חישובים כמו רכיב Insights) =====
const realm = (arr) => ({
  total: arr.length,
  g: arr.filter((k) => k.judgment === 'good').length,
  m: arr.filter((k) => k.judgment === 'mixed').length,
  b: arr.filter((k) => k.judgment === 'bad').length,
});
const avg = (arr) => Math.round((arr.reduce((s, k) => s + (k.end - k.start), 0) / arr.length) * 10) / 10;
const withRealm = [
  ...kings.judah.map((k) => ({ ...k, realm: 'יהודה' })),
  ...kings.israel.map((k) => ({ ...k, realm: 'ישראל' })),
  ...kings.united.map((k) => ({ ...k, realm: 'המאוחדת' })),
].map((k) => ({ id: k.id, name: k.name, realm: k.realm, dur: k.end - k.start }));

const density = [];
let peak = { n: 0, year: 0 };
for (let y = 2820; y <= 3460; y += 20) {
  const n = prophets.filter((p) => p.start <= y && p.end >= y).length;
  density.push({ y, n });
  if (n > peak.n) peak = { n, year: y };
}

const insights = {
  judah: realm(kings.judah), israel: realm(kings.israel),
  avgJudah: avg(kings.judah), avgIsrael: avg(kings.israel),
  longest: [...withRealm].sort((a, b) => b.dur - a.dur).slice(0, 6),
  density, maxDensity: Math.max(...density.map((d) => d.n)), peak,
  counts: {
    מלכים: kings.judah.length + kings.israel.length + kings.united.length,
    נביאים: prophets.length, שופטים: judges.length,
    'אבות ומנהיגים': leaders.length, אירועים: events.length,
    'ספרי תנ״ך': books.length, 'רקע עולמי': world.length,
  },
  longestBooks: books.map((b) => ({ id: b.id, name: b.name, span: b.end - b.start }))
    .sort((a, b) => b.span - a.span).slice(0, 6),
  longestProphets: prophets.map((p) => ({ id: p.id, name: p.name, span: p.end - p.start }))
    .sort((a, b) => b.span - a.span).slice(0, 6),
};

const data = { eras, genealogy, insights };
writeFileSync(join(ROOT, 'public', 'proto-data.json'), JSON.stringify(data), 'utf8');
console.log('proto-data.json:', eras.length, 'תקופות,', all.length, 'פריטים,',
  all.filter((x) => x.map).length, 'עם מפה,', genealogy.length, 'דורות באילן');
