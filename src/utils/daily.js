// "דמות היום" — בחירה דטרמיניסטית לפי התאריך: אותה דמות לכל המבקרים באותו
// יום, ומתחלפת מדי יום. כך הבחירה יציבה, ניתנת לשיתוף ("ראו את דמות היום"),
// ואינה קופצת בכל רענון. הזרע הוא מחרוזת התאריך המקומי (שנה-חודש-יום).
export function figureOfDay(persons, date = new Date()) {
  if (!persons || !persons.length) return null;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  // ערבול (avalanche) כדי שימים סמוכים ייפלו על דמויות מפוזרות ולא רצופות
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return persons[Math.abs(h) % persons.length];
}
