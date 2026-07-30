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

const projX = (lon, lat) => 226.10 * lon + 21.00 * lat - 8226.5;
const projY = (lon, lat) => -38.05 * lon - 311.53 * lat + 11836.5;

const pool = [...leaders, ...kings.united, ...kings.judah, ...kings.israel];
const fig = (id) => pool.find((x) => x.id === id);
const ev = (id) => events.find((x) => x.id === id);

const figCard = (id) => {
  const f = fig(id);
  const m = maps[id];
  return {
    id, name: f.name,
    sub: `${f.start}–${f.end}` + (f.lifeText ? ` · ${f.lifeText}` : f.reignText ? ` · ${f.reignText}` : ''),
    map: m ? {
      title: m.title,
      points: (m.points || []).sort((a, b) => a.order - b.order).map((p) => ({
        n: p.order, name: p.name, label: p.label, desc: p.desc,
        X: p.x != null ? p.x : projX(p.lon, p.lat),
        Y: p.y != null ? p.y : projY(p.lon, p.lat),
      })),
    } : null,
  };
};
const evCard = (id) => {
  const e = ev(id);
  return { id, name: e.name, sub: `אירוע · ${e.year}`, map: null };
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
