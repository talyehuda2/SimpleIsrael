// מקור אמת יחיד לרשימת הפריטים. שני המסכים - ציר הזמן ומסע הדורות -
// טוענים מכאן את אותם אובייקטים, כך שכרטיס הפריט מקבל בשניהם בדיוק את
// אותם שדות ואין צורך במתאם או בשכפול.
import leaders from './leaders.json';
import judges from './judges.json';
import kings from './kings.json';
import prophets from './prophets.json';
import books from './books.json';
import world from './world.json';
import events from './events.json';
import empires from './empires.json';
import periods from './periods.json';
import collections from './collections.json';

export const ALL_ITEMS = [
  ...leaders.map((x) => ({ ...x, kind: 'leader' })),
  ...judges.map((x) => ({ ...x, kind: 'judge' })),
  ...kings.united.map((x) => ({ ...x, kind: 'united' })),
  ...kings.judah.map((x) => ({ ...x, kind: 'judah' })),
  ...kings.israel.map((x) => ({ ...x, kind: 'israel' })),
  ...prophets.map((x) => ({ ...x, kind: 'prophet' })),
  ...books.map((x) => ({ ...x, kind: 'book' })),
  ...world.map((x) => ({ ...x, kind: 'world' })),
  ...events.map((x) => ({ ...x, kind: 'event', start: x.year, end: x.year })),
  ...empires.map((x) => ({ ...x, kind: 'empire' })),
];

export const itemKey = (it) => `${it.kind}:${it.id}`;

export function resolveKey(key) {
  if (!key) return null;
  const i = key.indexOf(':');
  if (i < 0) return null;
  const kind = key.slice(0, i), id = key.slice(i + 1);
  return ALL_ITEMS.find((x) => x.kind === kind && x.id === id) || null;
}

export const byId = (id) => ALL_ITEMS.find((x) => x.id === id) || null;

// חפיפה בזמן - ההגדרה של "בני-הזמן", זהה בשני המסכים ובדפי הנחיתה
export function overlaps(a, b) {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
}

export const SORTED_PERIODS = [...periods].sort((a, b) => a.start - b.start);

// התקופה שבה הפריט מתחיל
export const periodOf = (it) =>
  SORTED_PERIODS.find((p) => it.start >= p.start && it.start < p.end)
  || SORTED_PERIODS.find((p) => it.start >= p.start && it.start <= p.end)
  || null;

// האוספים שהפריט שייך אליהם
export const collectionsOf = (id) => collections.filter((c) => c.members.includes(id));
