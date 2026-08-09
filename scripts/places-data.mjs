/* מחולל אינדקס המקומות: הופך את maps.json מ"דמות -> תחנות" ל"מקום -> מי
   עבר בו ומה קרה שם". זה הציר השלישי של האתר, לצד הזמן והדמות.

   מיזוג שמות נעשה בשלוש שכבות, מהבטוח לרחב:
   1. טבלת כינויים מפורשת - מקומות שנקראים בשמות שונים לגמרי.
   2. "X (הסבר)" מתמזג ל-X כאשר X קיים בפני עצמו כתחנה.
   3. שאר השמות נשארים כמות שהם.
   מיזוג לפי קרבה גאוגרפית נשלל בכוונה: בית לחם וירושלים מרוחקות
   12 פיקסלים על המפה, וכל סף שהיה מאחד כינויים היה מאחד גם אותן. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeyStations } from '../src/utils/mapProject.js';

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

const ITEMS = [
  ...leaders.map((x) => ({ ...x, kind: 'leader' })),
  ...judges.map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...prophets.map((x) => ({ ...x, kind: 'prophet' })),
  ...books.map((x) => ({ ...x, kind: 'book' })),
  ...world.map((x) => ({ ...x, kind: 'world' })),
  ...events.map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
];
const byId = Object.fromEntries(ITEMS.map((x) => [x.id, x]));

// מקומות שנקראים בשמות שונים לגמרי - אין דרך לזהות אותם אוטומטית
const ALIAS = {
  'עיר התמרים': 'יריחו',
  'אפרת': 'בית לחם',
  'ארם נהריים': 'חרן',
  'הרמה': 'רמה',
  'רמתיים צופים': 'רמה',
  'גיא בן הינום': 'ירושלים',
  'הר המוריה': 'ירושלים',
  'עיר דוד': 'ירושלים',
  'הר ציון': 'ירושלים',
  'הר סיני': 'הר סיני (חורב)',
  'הר האלוקים': 'הר סיני (חורב)',
  'חורב': 'הר סיני (חורב)',
};

const base = (name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const slugify = (s) => s.replace(/[()]/g, '').trim().replace(/\s+/g, '-');

// שלב א: אילו שמות-בסיס קיימים כתחנה עצמאית?
const standalone = new Set();
for (const m of Object.values(maps)) {
  for (const p of (m.points || [])) if (p.name === base(p.name)) standalone.add(p.name.trim());
}

function canonical(rawName) {
  const n = rawName.trim();
  if (ALIAS[n]) return ALIAS[n];
  const b = base(n);
  if (ALIAS[b]) return ALIAS[b];
  if (b !== n && standalone.has(b)) return b;   // "חברון (המכפלה)" -> "חברון"
  return n;
}

// שלב ב: איסוף
const places = new Map();
for (const [itemId, m] of Object.entries(maps)) {
  const item = byId[itemId];
  if (!item) continue;
  for (const st of journeyStations(m)) {
    const name = canonical(st.name);
    if (!places.has(name)) places.set(name, { name, xs: [], ys: [], visits: [], aka: new Set() });
    const p = places.get(name);
    p.xs.push(st.x); p.ys.push(st.y);
    if (st.name.trim() !== name) p.aka.add(st.name.trim());
    p.visits.push({
      id: item.id, kind: item.kind, name: item.name,
      year: item.start, label: st.label || '', desc: st.desc || '',
    });
  }
}

const out = [...places.values()].map((p) => {
  // ממוצע חסין-חריגים: חציון, כדי שתחנה אחת שהוצבה ידנית לא תזיז את הנקודה
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const visits = p.visits.sort((a, b) => (a.year || 0) - (b.year || 0));
  const years = visits.map((v) => v.year).filter(Boolean);
  return {
    id: slugify(p.name),
    name: p.name,
    aka: [...p.aka],
    x: +med(p.xs).toFixed(1),
    y: +med(p.ys).toFixed(1),
    from: years.length ? Math.min(...years) : null,
    to: years.length ? Math.max(...years) : null,
    visits,
  };
}).sort((a, b) => b.visits.length - a.visits.length);

writeFileSync(join(ROOT, 'src', 'data', 'places.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');

const rich = out.filter((p) => p.visits.length >= 3);
console.log(`places.json: ${out.length} מקומות, ${out.reduce((s, p) => s + p.visits.length, 0)} ביקורים`);
console.log(`עשירים (3+ ביקורים): ${rich.length}`);
console.log(rich.slice(0, 14).map((p) => `  ${p.name.padEnd(16)} ${String(p.visits.length).padStart(2)} ביקורים · ${p.from}–${p.to}${p.aka.length ? ' · גם: ' + p.aka.join(', ') : ''}`).join('\n'));
