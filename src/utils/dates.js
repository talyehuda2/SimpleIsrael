// המרות תאריכים: שנה עברית (למניין העולם, לפי סדר עולם) <-> לפנה"ס/לספירה.
// ההמרה: לפנה"ס = 3761 - שנה עברית; לספירה = שנה עברית - 3760 (בקירוב של שנה).

const GEMATRIA = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
  [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'],
  [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'],
  [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א'],
];

export function hebrewYearLetters(year) {
  const thousands = Math.floor(year / 1000);
  let rest = year % 1000;
  let s = '';
  while (rest > 0) {
    if (rest === 15) { s += 'טו'; break; }
    if (rest === 16) { s += 'טז'; break; }
    for (const [v, letter] of GEMATRIA) {
      if (rest >= v) { s += letter; rest -= v; break; }
    }
  }
  if (s.length > 1) s = s.slice(0, -1) + '"' + s.slice(-1);
  else if (s.length === 1) s += "'";
  const th = GEMATRIA.find(([v]) => v === thousands);
  return (th ? th[1] + "'" : '') + s;
}

export function toSecular(year) {
  if (year < 3761) return `${3761 - year} לפנה"ס`;
  return `${year - 3760} לספירה`;
}

export function formatYear(year) {
  return `${hebrewYearLetters(year)} (${year}) · ${toSecular(year)}`;
}

export function formatRange(start, end) {
  if (start === end) return formatYear(start);
  return `${hebrewYearLetters(start)}–${hebrewYearLetters(end)} (${start}–${end}) · ${toSecular(start)} עד ${toSecular(end)}`;
}
