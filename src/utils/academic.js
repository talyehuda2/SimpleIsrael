// בניית נתוני המצב האקדמי: לוקח את הנתונים המקוריים (מיקום לפי שנה עברית),
// מחליף אותם בתאריכים מחקריים מתוך academic.json, וממיר ל"שנה עברית שקולה"
// כדי לעשות שימוש חוזר באותו מנגנון מיקום. פריטים שאין להם תאריך אקדמי — מסוננים החוצה.

import academic from '../data/academic.json';
import kings from '../data/kings.json';
import prophets from '../data/prophets.json';
import books from '../data/books.json';
import events from '../data/events.json';
import periods from '../data/periods.json';

// שנה מחקרית (חיובי=לפנה"ס, שלילי=לספירה) -> שנה עברית שקולה למניין העולם
export function bceToAm(y) {
  return y > 0 ? 3761 - y : 3760 - y;
}

function remapSpans(arr, map) {
  return arr
    .filter((it) => map[it.id])
    .map((it) => {
      const [s, e] = map[it.id];
      return { ...it, start: bceToAm(s), end: bceToAm(e) };
    });
}

function remapEvents(arr, map) {
  return arr
    .filter((it) => map[it.id] != null)
    .map((it) => ({ ...it, year: bceToAm(map[it.id]) }));
}

export const academicData = {
  leaders: [], // תקופת האבות והשופטים אינה מתוארכת בהסכמה מחקרית
  judges: [],
  periods: remapSpans(periods, academic.periods),
  events: remapEvents(events, academic.events),
  prophets: remapSpans(prophets, academic.prophets),
  books: remapSpans(books, academic.books),
  kings: {
    united: remapSpans(kings.united, academic.kings),
    judah: remapSpans(kings.judah, academic.kings),
    israel: remapSpans(kings.israel, academic.kings),
  },
};
