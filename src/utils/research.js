// השנה המחקרית של פריט, להצגה בכרטיס לצד השנה לפי סדר עולם.
//
// הציר עצמו נשאר כולו לפי סדר עולם - שני מספרים על כל פס היו מבלבלים. אבל
// גולשים שלמדו את התאריכים המחקריים (קורס מורי דרך, למשל) פנו ושאלו למה
// חורבן בית ראשון "לא נכון". בכרטיס, ורק בו, מופיעה גם השנה המחקרית.
//
// מקובץ נפרד ולא מ-academic.js, שמייבא את כל קובצי הנתונים - הכרטיס צריך
// רק את הטבלה הקטנה. המזהים ייחודיים בין הקטגוריות (נבדק), ולכן חיפוש אחד.
import academic from '../data/academic.json';

const BY_ID = {};
for (const [section, map] of Object.entries(academic)) {
  if (section === '_note') continue;
  for (const [id, v] of Object.entries(map)) BY_ID[id] = Array.isArray(v) ? v : [v, v];
}

// חיובי = לפנה"ס, שלילי = לספירה (כמו ב-academic.json)
const fmt = (y) => (y > 0 ? `${y} לפנה"ס` : `${-y} לספירה`);

export function researchRange(id) {
  const r = BY_ID[id];
  if (!r) return null;
  const [s, e] = r;
  if (s === e) return fmt(s);
  // באותו נוסח של השורה שמעליה ("X לפנה"ס עד Y לפנה"ס"): כך משווים עין
  // בעין, ו"715–686" בתוך שורה עברית מתהפך ויזואלית ונקרא הפוך
  return `${fmt(s)} עד ${fmt(e)}`;
}
