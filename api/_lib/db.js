/* שכבת ההגבלה של הסוכן: מטמון תשובות, מכסה יומית לגולש ותקציב יומי לאתר.
   הכל נאכף כאן, בשרת - הגבלה בצד לקוח היא הצעה מנומסת שכל אחד עוקף.

   הגישה ל-Supabase היא ב-fetch ישיר ולא דרך supabase-js: שתי קריאות REST
   פשוטות לא מצדיקות לגרור ספרייה שלמה לתוך פונקציה serverless, שמשלמת
   על כל בייט בזמן ההתנעה הקרה.

   משתני סביבה (בדשבורד של Vercel בלבד, לעולם לא בקוד):
     SUPABASE_SERVICE_KEY - מפתח service_role, עוקף RLS. סוד אמיתי.
     ASK_IP_SALT          - מלח לגיבוב כתובות IP. בלעדיו הגיבוב הפיך
                            בכוח גס: יש רק ~4 מיליארד כתובות אפשריות. */
import { createHash } from 'node:crypto';
import { SUPABASE_URL } from '../../src/lib/supabaseConfig.js';

const KEY = process.env.SUPABASE_SERVICE_KEY;
const SALT = process.env.ASK_IP_SALT;

/** האם שכבת ההגבלה מוגדרת. בלעדיה אין לפתוח את הסוכן לציבור. */
export const dbReady = () => Boolean(KEY && SALT);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const rest = (path, init) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
});

/* נרמול השאלה לפני הגיבוב - זה מה שהופך את המטמון למועיל.
   בלעדיו "מי היה אליהו?" ו-"מי היה אליהו" הן שתי שאלות שונות,
   וכל וריאציה בפיסוק משלמת שוב על אותה תשובה. */
export const qhashOf = (q) => sha256(
  q.replace(/[\u0591-\u05C7]/g, '')     // ניקוד וטעמים
    .replace(/["'\u05F3\u05F4]/g, '')   // גרשיים וגרש עברי
    .replace(/[?!.,;:\-]+/g, ' ')       // פיסוק
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()                      // משפיע רק על מילים לועזיות
);

/* כתובת ה-IP עצמה לא נשמרת. מה שנשמר הוא גיבוב שלה עם מלח סודי -
   מספיק כדי לספור מכסה, לא מספיק כדי לזהות אדם. */
export const ipHashOf = (req) => {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  const ip = fwd.split(',')[0].trim() || 'unknown';
  return sha256(ip + SALT);
};

/**
 * בדיקה אחת שמחזירה מטמון, תקציב ומכסה.
 * @returns {Promise<object|null>} null אם הבדיקה עצמה נכשלה
 */
export async function askGate({ ipHash, qhash, maxDay, budgetCents, cacheDays }) {
  try {
    const res = await rest('rpc/ask_gate', {
      method: 'POST',
      body: JSON.stringify({
        p_ip_hash: ipHash,
        p_qhash: qhash,
        p_max_day: maxDay,
        p_budget_cents: budgetCents,
        p_cache_days: cacheDays,
      }),
    });
    if (!res.ok) {
      console.error('ask_gate failed', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('ask_gate unreachable', err);
    return null;
  }
}

/**
 * רישום השאלה ביומן. answer=null בכוונה כשלא נוצרה תשובה אמיתית -
 * כך שהודעת "לא הצלחתי" לא נתקעת במטמון ומוגשת לכל מי שישאל אחריה.
 * כישלון כאן לא מפיל את הבקשה: הגולש כבר קיבל תשובה, והחוב לרישום
 * הוא שלנו ולא שלו.
 */
export async function logAsk(row) {
  try {
    const res = await rest('ask_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        qhash: row.qhash,
        question: row.question,
        answer: row.answer || null,
        cost_cents: row.costCents || 0,
        served_from: row.servedFrom,
        ip_hash: row.ipHash,
      }),
    });
    if (!res.ok) console.error('ask_log insert failed', res.status, await res.text());
  } catch (err) {
    console.error('ask_log unreachable', err);
  }
}
