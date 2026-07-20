// המרת מחרוזת מקור עברית (למשל "מלכים ב י\"ז") לקישור לספריא.
// מחזיר מערך קטעים: כל קטע הוא {text} (טקסט רגיל) או {text, href} (קישור).
// מקורות שאינם תנ״ך (תלמוד, יוסף בן מתתיהו וכו') נשארים כטקסט רגיל.

const BOOKS = {
  'בראשית': 'Genesis',
  'שמות': 'Exodus',
  'ויקרא': 'Leviticus',
  'במדבר': 'Numbers',
  'דברים': 'Deuteronomy',
  'יהושע': 'Joshua',
  'שופטים': 'Judges',
  'שמואל א': 'I_Samuel',
  'שמואל ב': 'II_Samuel',
  'מלכים א': 'I_Kings',
  'מלכים ב': 'II_Kings',
  'ישעיהו': 'Isaiah',
  'ירמיהו': 'Jeremiah',
  'יחזקאל': 'Ezekiel',
  'הושע': 'Hosea',
  'יואל': 'Joel',
  'עמוס': 'Amos',
  'עובדיה': 'Obadiah',
  'יונה': 'Jonah',
  'מיכה': 'Micah',
  'נחום': 'Nahum',
  'חבקוק': 'Habakkuk',
  'צפניה': 'Zephaniah',
  'חגי': 'Haggai',
  'זכריה': 'Zechariah',
  'מלאכי': 'Malachi',
  'דניאל': 'Daniel',
  'עזרא': 'Ezra',
  'נחמיה': 'Nehemiah',
  'דברי הימים א': 'I_Chronicles',
  'דברי הימים ב': 'II_Chronicles',
  'דברי הימים': 'I_Chronicles',
  'מגילת אסתר': 'Esther',
  'אסתר': 'Esther',
  'רות': 'Ruth',
  'איכה': 'Lamentations',
};

// שמות ספרים ממוינים מהארוך לקצר — כדי ש"מלכים ב" יזוהה לפני "מלכים",
// ו"דברי הימים ב" לפני "דברי הימים".
const KEYS = Object.keys(BOOKS).sort((a, b) => b.length - a.length);

const GEM = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
  'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
};

function gematria(token) {
  let sum = 0;
  for (const ch of token) sum += GEM[ch] || 0;
  return sum || null;
}

// הפרק הראשון שמופיע ברצף (מתעלם מגרשיים ומטווחים)
function firstChapter(rem) {
  const m = rem.trim().match(/^[א-ת'"׳״]+/);
  return m ? gematria(m[0]) : null;
}

function matchBook(s) {
  for (const key of KEYS) {
    if (s === key || s.startsWith(key + ' ') || s.startsWith(key + '–') || s.startsWith(key + '-')) {
      return { key, slug: BOOKS[key] };
    }
  }
  return null;
}

export function sourceSegments(source) {
  if (!source) return [];
  return source.split(/;\s*/).map((raw) => {
    const text = raw.trim();
    // טווח בין-ספרי ("מלכים א י\"ז – מלכים ב ב'") — מקשרים לתחילתו
    const refPart = text.split(/\s+[–-]\s+/)[0];
    const book = matchBook(refPart);
    if (!book) return { text };
    const ch = firstChapter(refPart.slice(book.key.length));
    const href = ch
      ? `https://www.sefaria.org.il/${book.slug}.${ch}?lang=he`
      : `https://www.sefaria.org.il/${book.slug}?lang=he`;
    return { text, href };
  });
}
