// מצב ניהול: טוקן שנשמר רק בדפדפן של המנהל (localStorage) ולעולם לא בקוד האתר.
// המחיקה עצמה מתבצעת בפונקציה בצד השרת (admin_delete_comment) שמאמתת את הטוקן,
// כך שגם מי שיקרא את קוד האתר לא יוכל למחוק דבר.
const KEY = 'si_admin_token';
const AT = 'si_admin_token_at';   // מתי נשמר לאחרונה, כדי שתהיה לו תפוגה

/* למה יש כאן תפוגה בכלל:
   הטוקן הוא מפתח יחיד וקבוע שפותח את כל תיבת הפניות - כולל פרטי הקשר
   של כל מי שכתב. בלי תפוגה הוא נשאר לנצח בכל דפדפן שבו הוקלד אי פעם:
   מחשב שהושאל, טלפון שנמכר, פרופיל שמסונכרן לענן. תיקון 13 לחוק הגנת
   הפרטיות הוסיף חובת דיווח על אירוע אבטחה, ודליפה כאן היא דליפת פרטי
   קשר של גולשים.

   החלון מתגלגל ולא קבוע: כל שימוש מאריך אותו בשלושים יום נוספים. חלון
   קבוע היה מכריח הקלדה מחדש של מחרוזת ארוכה בטלפון כל חודש - ומסך
   הניהול נבנה בדיוק כדי לענות מהטלפון. דפדפן פעיל נשאר מחובר; דפדפן
   נטוש שוכח.

   מה זה לא פותר: מי שהעתיק את מחרוזת הטוקן עצמה. לזה נדרשת בדיקת תפוגה
   בצד השרת, בגוף admin_inbox ו-admin_delete_comment. */
const MAX_AGE_DAYS = 30;
const MAX_AGE = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const TOUCH_EVERY = 24 * 60 * 60 * 1000;   // לרענן את החותמת לכל היותר פעם ביום

const now = () => Date.now();

export function getAdminToken() {
  try {
    const token = localStorage.getItem(KEY) || '';
    if (!token) return '';

    /* חותמת חסרה = טוקן מלפני התפוגה. מתייחסים אליו כפג-תוקף במכוון:
       זו הדרך היחידה להבטיח שכל דפדפן שכבר מחזיק אותו יזדהה מחדש פעם
       אחת, ובכך גם ייצא ממנו כל דפדפן ישן ששכחת ממנו. */
    const at = Number(localStorage.getItem(AT) || 0);
    const age = now() - at;
    if (!at || age > MAX_AGE) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(AT);
      return '';
    }

    // חלון מתגלגל, אבל בלי כתיבה בכל קריאה - getAdminToken נקרא הרבה
    if (age > TOUCH_EVERY) localStorage.setItem(AT, String(now()));
    return token;
  } catch { return ''; }
}

export function setAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem(KEY, token);
      localStorage.setItem(AT, String(now()));
    } else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(AT);
    }
  } catch { /* מתעלמים */ }
}

/** כמה ימים נשארו לטוקן הנוכחי, או null אם אין טוקן תקף */
export function adminTokenDaysLeft() {
  try {
    if (!localStorage.getItem(KEY)) return null;
    const at = Number(localStorage.getItem(AT) || 0);
    if (!at) return null;
    return Math.max(0, Math.ceil((MAX_AGE - (now() - at)) / 86400000));
  } catch { return null; }
}

// כניסה/יציאה ממצב ניהול דרך ?admin=1 בכתובת
export function handleAdminParam() {
  const p = new URLSearchParams(window.location.search);
  if (!p.has('admin')) return false;
  const current = getAdminToken();
  if (current) {
    if (window.confirm('לצאת ממצב ניהול?')) setAdminToken('');
  } else {
    const t = window.prompt('הדביקו את טוקן הניהול:');
    if (t) setAdminToken(t.trim());
  }
  p.delete('admin');
  const qs = p.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
  return true;
}
