/* מדידה - מה אנשים באמת פותחים.

   שתי בעיות שהקובץ הזה פותר.

   הראשונה: שלושת המסכים הם שלוש נקודות כניסה נפרדות, ו-inject() רץ עד
   עכשיו רק בציר הזמן. מסע הדורות ומפת הארץ לא נמדדו כלל - שני שלישים
   מהאתר היו שקופים.

   השנייה, והיא החשובה: פתיחת דמות אינה משנה את הנתיב אלא רק את ה-query
   (/?sel=prophet:eliyahu). דוח העמודים של Vercel מקבץ לפי נתיב, ולכן
   הוא מראה שורה אחת בשם "/" ולא אומר דבר על מי מעניין. התשובה לשאלה
   "אילו אזורים מעניינים" היא אירוע מפורש, לא כתובת.

   קטלוג האירועים (כולם דרך trackOnce אלא אם צוין אחרת):
     item_open   {kind,id}  ציר הזמן  - איזו דמות נפתחה
     place_open  {id}       מפת הארץ  - איזה מקום נפתח
     era_reached {era}      מסע הדורות - עד לאיזו תקופה גללו
     search_miss {q}        חיפוש     - מה חיפשו ולא מצאו
     view_chosen {view}     מסך פתיחה - באיזה מבט בחרו (track, לא once)
     map_open    {id}       ציר הזמן  - מפת מסע נפתחה
     tree_open / tours_open / guide_open   - שימוש בפיצ'רים */

import { inject, track } from '@vercel/analytics';

export function startAnalytics() {
  // בפיתוח נטען סקריפט הדיבאג, שמדפיס כל אירוע לקונסולה במקום לשלוח -
  // כך אפשר לוודא שהאירועים נורים בלי ללכלך את הנתונים האמיתיים.
  inject({ mode: import.meta.env.PROD ? 'production' : 'development' });
}

/* פריט נספר פעם אחת לטעינת עמוד. השאלה היא "לכמה אנשים הוא הגיע" ולא
   "כמה לחיצות היו" - מבקר שחוזר לאליהו שלוש פעמים אינו שלושה מתעניינים,
   והוא גם לא צריך לאכול שלוש יחידות ממכסת האירועים החודשית. */
const fired = new Set();

export function trackOnce(name, props) {
  const key = props ? `${name}:${Object.values(props).join('|')}` : name;
  if (fired.has(key)) return;
  fired.add(key);
  track(name, props);
}

export { track };
