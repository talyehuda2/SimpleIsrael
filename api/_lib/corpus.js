/* מאגר הידע של הסוכן: אינדקס דחוס שנשלח בכל שאלה, ושליפה מלאה לפי דרישה.
   הרעיון - במקום לשלוח 320K תווים של נתונים בכל שאלה, נשלח תוכן עניינים
   של ~6K טוקנים שאומר למודל *מה קיים ומה המזהים*, והוא שולף את הרשומות
   המלאות שהוא צריך דרך כלי. */
import leaders from '../../src/data/leaders.json' with { type: 'json' };
import judges from '../../src/data/judges.json' with { type: 'json' };
import kings from '../../src/data/kings.json' with { type: 'json' };
import prophets from '../../src/data/prophets.json' with { type: 'json' };
import books from '../../src/data/books.json' with { type: 'json' };
import world from '../../src/data/world.json' with { type: 'json' };
import events from '../../src/data/events.json' with { type: 'json' };
import empires from '../../src/data/empires.json' with { type: 'json' };
import periods from '../../src/data/periods.json' with { type: 'json' };
import collections from '../../src/data/collections.json' with { type: 'json' };
import places from '../../src/data/places.json' with { type: 'json' };
import maps from '../../src/data/maps.json' with { type: 'json' };

// זהה ל-src/data/items.js - אותו מקור אמת, אבל עם ייבוא תקני של Node
// (items.js מייבא JSON בלי import attributes, מה שעובד רק דרך Vite)
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

const KIND_LABEL = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך הממלכה המאוחדת',
  judah: 'מלך יהודה', israel: 'מלך ישראל', prophet: 'נביא',
  book: 'ספר תנ״ך', world: 'דמות עולמית', event: 'אירוע', empire: 'מעצמה',
};

const byKey = new Map(ALL_ITEMS.map((it) => [`${it.kind}:${it.id}`, it]));
const placeById = new Map(places.map((p) => [p.id, p]));
const sortedPeriods = [...periods].sort((a, b) => a.start - b.start);
const periodAt = (y) => sortedPeriods.find((p) => y >= p.start && y < p.end)
  || sortedPeriods.find((p) => y >= p.start && y <= p.end) || null;

/* האינדקס: שורה לכל פריט, בלי תיאורים. המודל לא צריך משפט הסבר כדי
   לדעת שאליהו קיים ושהוא נביא - הוא צריך את זה כדי לבחור מה לשלוף. */
const itemLines = ALL_ITEMS
  .slice()
  .sort((a, b) => a.start - b.start)
  .map((it) => `${it.kind}:${it.id}|${it.name}|${KIND_LABEL[it.kind]}|${it.start}-${it.end}`);

const placeLines = places
  .slice()
  .sort((a, b) => b.visits.length - a.visits.length)
  .map((p) => `place:${p.id}|${p.name}|${p.visits.length} אירועים|${p.from}-${p.to}`);

const periodLines = sortedPeriods.map((p) => `period:${p.id}|${p.name}|${p.start}-${p.end}`);
const collectionLines = collections.map((c) => `collection:${c.id}|${c.title}|${c.members.length} פריטים`);

export const INDEX = `## תקופות
${periodLines.join('\n')}

## דמויות, אירועים וספרים (${ALL_ITEMS.length}) - מזהה|שם|סוג|שנים לבריאה
${itemLines.join('\n')}

## מקומות (${places.length}) - מזהה|שם|מספר אירועים|טווח שנים
${placeLines.join('\n')}

## אוספים
${collectionLines.join('\n')}`;

/* רשומה מלאה - רק למה שהמודל ביקש במפורש. כולל את תחנות המסע
   מ-maps.json, שהתיאורים שלהן הם חלק גדול מהתוכן הייחודי של האתר. */
function itemRecord(key) {
  const it = byKey.get(key);
  if (!it) return null;
  const era = periodAt(it.start);
  const journey = maps[it.id];
  const rec = {
    key,
    name: it.name,
    kind: KIND_LABEL[it.kind],
    years: it.start === it.end ? String(it.start) : `${it.start}-${it.end}`,
    period: era ? era.name : null,
    description: it.description || null,
  };
  if (it.verse) rec.verse = it.verseRef ? `${it.verse} (${it.verseRef})` : it.verse;
  if (it.source) rec.source = it.source;
  if (it.reignText) rec.reign = it.reignText;
  if (it.lifeText) rec.life = it.lifeText;
  if (it.tenureText) rec.tenure = it.tenureText;
  if (it.kings) rec.duringKings = it.kings;
  if (it.empire) rec.empire = it.empire;
  if (journey && journey.points) {
    rec.journey = journey.points
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ stop: p.name, what: p.label, detail: p.desc }));
  }
  const inCollections = collections.filter((c) => c.members.includes(it.id));
  if (inCollections.length) rec.collections = inCollections.map((c) => c.title);
  return rec;
}

function placeRecord(id) {
  const p = placeById.get(id);
  if (!p) return null;
  /* לירושלים 36 אירועים - רשומה מלאה שלה היא ~9K תווים, ושליפה של שלושה
     מקומות כאלה מפוצצת את הבקשה. במקום צנזורה שרירותית: מקום עמוס מחזיר
     את השלד (מי, מתי, מה) בלי התיאור המלא, והמודל יכול לשלוף את הדמות
     עצמה אם הוא צריך את הסיפור. */
  const verbose = p.visits.length <= 12;
  return {
    key: `place:${p.id}`,
    name: p.name,
    alsoKnownAs: p.aka && p.aka.length ? p.aka : undefined,
    years: `${p.from}-${p.to}`,
    note: verbose ? undefined : 'מקום עמוס - לפרטים מלאים שלפו את הדמות עצמה',
    events: p.visits.map((v) => ({
      who: v.name,
      key: `${v.kind}:${v.id}`,
      year: v.year,
      what: v.label,
      detail: verbose ? v.desc : undefined,
    })),
  };
}

/** שליפת רשומות מלאות לפי מזהים ("prophet:eliyahu", "place:ירושלים") */
export function getRecords(keys) {
  const out = [];
  for (const key of keys.slice(0, 8)) {
    const rec = key.startsWith('place:') ? placeRecord(key.slice(6)) : itemRecord(key);
    out.push(rec || { key, error: 'לא נמצא מזהה כזה' });
  }
  return out;
}

/** בני הזמן של פריט - מי חי או התרחש במקביל */
export function getContemporaries(key) {
  const it = byKey.get(key);
  if (!it) return { key, error: 'לא נמצא מזהה כזה' };
  const overlaps = (a, b) => {
    if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
    if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
    return a.start < b.end && a.end > b.start;
  };
  return {
    key,
    name: it.name,
    contemporaries: ALL_ITEMS
      .filter((o) => !(o.kind === it.kind && o.id === it.id) && overlaps(it, o))
      .sort((a, b) => a.start - b.start)
      .map((o) => `${o.kind}:${o.id}|${o.name}|${KIND_LABEL[o.kind]}|${o.start}-${o.end}`),
  };
}
