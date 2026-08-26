/* מדידה - מה אנשים באמת פותחים.

   שים לב לשמות: הקובץ הזה נקרא trail.js והטבלה si_trail, ולא
   "analytics" ו-"events". זה לא קפריזה - חוסמי פרסומות מסננים לפי
   תבנית בשם הקובץ ובנתיב הבקשה, ובגרסה הקודמת הם חסמו את שניהם:
   הצ'אנק analytics-*.js לא נטען כלל, ולכן גם inject() של Vercel
   מעולם לא רץ אצל אותם גולשים.

   העבודה מחולקת בין שני יעדים, וזו חלוקה מכוונת:

   צפיות עמוד -> Vercel. חינם בחבילת Hobby, ומגיעות עם מדינה, מכשיר ומקור
   תנועה בלי שנצטרך לחשב אותם. עד עכשיו inject() רץ רק בציר הזמן, ולכן
   מסע הדורות ומפת הארץ לא נמדדו כלל - שני שלישים מהאתר היו שקופים.

   אירועים מותאמים -> Supabase. ב-Vercel הם אינם נתמכים כלל ב-Hobby, וגם
   ב-Pro מוגבלים לשני מאפיינים לאירוע ולחלון דיווח של שנה. כאן אין הגבלה,
   אין תפוגה, והנתונים בבעלותך.

   הבעיה שהאירועים פותרים: פתיחת דמות אינה משנה את הנתיב אלא רק את ה-query
   (/?sel=prophet:eliyahu). דוח העמודים מקבץ לפי נתיב, ולכן כל 164 הדמויות
   מתקבצות לשורה אחת בשם "/". "אילו אזורים מעניינים" היא שאלה שרק אירוע
   מפורש עונה עליה.

   קטלוג האירועים (כולם דרך markOnce אלא אם צוין אחרת):
     item_open   {kind,id}  ציר הזמן   - איזו דמות נפתחה
     place_open  {id}       מפת הארץ   - איזה מקום נפתח
     era_reached {era}      מסע הדורות - עד לאיזו תקופה גללו
     search_miss {q}        חיפוש      - מה חיפשו ולא מצאו
     view_chosen {view}     מסך פתיחה  - באיזה מבט בחרו (mark, לא once)
     map_open    {id}       ציר הזמן   - מפת מסע נפתחה
     tree_open / tours_open / guide_open   - שימוש בפיצ'רים

   page_view              כל מסך     - ספירת תנועה בלתי-תלויה ב-Vercel
import { inject } from '@vercel/analytics';
import { SUPABASE_URL, SUPABASE_KEY } from './supabaseConfig.js';

const DEV = !import.meta.env.PROD;

/* מזהה ביקור, לא מזהה אדם: אקראי, יושב ב-sessionStorage ומת עם הטאב.
   הוא מאפשר להבדיל בין "עשרה אנשים פתחו את אליהו" לבין "אחד פתח עשר
   פעמים" - בלי לעקוב אחרי אף אחד בין ביקורים. */
const SESSION = (() => {
  try {
    let s = sessionStorage.getItem('si_sid');
    if (!s) {
      s = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)).slice(0, 12);
      sessionStorage.setItem('si_sid', s);
    }
    return s;
  } catch { return 'no-storage'; }
})();

// רק הדומיין ולא הכתובת המלאה, ומעבר בין המסכים שלנו אינו "מקור תנועה"
const REF = (() => {
  try {
    if (!document.referrer) return null;
    const h = new URL(document.referrer).host;
    return h === location.host ? null : h;
  } catch { return null; }
})();

const DEVICE = window.innerWidth < 768 ? 'mobile' : 'desktop';

export function startTrail() {
  inject({ mode: DEV ? 'development' : 'production' });
  // ספירה משלנו: הסקריפט של Vercel יושב על /_vercel/insights ונחסם אצל
  // חלק מהגולשים בלי שנדע. השורה הזו היא הבסיס שכן בשליטתנו.
  mark('page_view');
}

/* keepalive כדי שאירוע שנורה רגע לפני מעבר עמוד עדיין יגיע. כל שגיאה
   נבלעת בשקט: מדידה שמפילה את האתר גרועה מאין מדידה בכלל. */
function send(name, props) {
  if (DEV) { console.debug('[si-trail]', name, props || ''); return; }
  try {
    fetch(`${SUPABASE_URL}/rest/v1/si_trail`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        name,
        props: props || null,
        path: location.pathname,
        session: SESSION,
        ref: REF,
        device: DEVICE,
      }),
    }).catch(() => { /* מתעלמים */ });
  } catch { /* מתעלמים */ }
}

export function mark(name, props) { send(name, props); }

/* פריט נספר פעם אחת לטעינת עמוד. השאלה היא "לכמה אנשים הוא הגיע" ולא
   "כמה לחיצות היו" - מבקר שחוזר לאליהו שלוש פעמים אינו שלושה מתעניינים. */
const fired = new Set();

export function markOnce(name, props) {
  const key = props ? `${name}:${Object.values(props).join('|')}` : name;
  if (fired.has(key)) return;
  fired.add(key);
  send(name, props);
}
