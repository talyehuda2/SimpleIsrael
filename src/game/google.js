/* כפתור "המשך עם Google" הרשמי של גוגל, על האתר עצמו.

   למה לא ההפניה של Supabase (signInWithOAuth): שם גוגל מחזיר את התשובה לשרת
   של Supabase, ולכן מסך ההסכמה אומר "כניסה אל qexatjrxbduysvmstfnk.supabase.co"
   - כתובת שנראית כמו פישינג. כאן גוגל מוסר את האישור (ID token) ישירות לדף,
   ומציג simpleisrael.co.il. הדף מעביר אותו ל-Supabase ב-signInWithIdToken.
   דומיין מותאם ב-Supabase היה פותר את זה בלי קוד, אבל בתשלום חודשי.

   הסקריפט של גוגל נטען רק כשחלון ההתחברות נפתח, לא לכל גולש. אם הוא לא
   נטען (חוסם, רשת, CSP) - החלון נשאר עם כפתור ההפניה הישן, שעובד.

   ה-Client ID ציבורי מעצם הגדרתו: הוא מופיע בכל דף שמציג את הכפתור.
   ה-secret נשאר ב-Supabase בלבד. */

export const GOOGLE_CLIENT_ID = '790918609498-nhrhopovb7rajb21bj098d642q92o67f.apps.googleusercontent.com';

let loading = null;
function loadGsi() {
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new Error('אין Client ID'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  loading ||= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? ok(window.google) : fail(new Error('gsi')));
    s.onerror = () => { loading = null; fail(new Error('gsi')); };
    document.head.append(s);
  });
  return loading;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/* nonce: גוגל חותם בתוך האישור את הגיבוב, ו-Supabase מקבל את המקור ובודק
   שהגיבוב שלו תואם. כך אישור שנגנב מדף אחר לא שווה כלום בדף הזה. */
async function makeNonce() {
  const raw = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  return { raw, hashed };
}

/** מצייר את הכפתור בתוך el. onToken(idToken, rawNonce) נקרא אחרי שהשחקן אישר. */
export async function renderGoogleButton(el, onToken) {
  const google = await loadGsi();
  const nonce = await makeNonce();
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: nonce.hashed,
    callback: (r) => onToken(r.credential, nonce.raw),
    ux_mode: 'popup',
    use_fedcm_for_button: true,
    itp_support: true,
  });
  google.accounts.id.renderButton(el, {
    type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
    text: 'continue_with', logo_alignment: 'center', locale: 'he',
    // el עצמו מוסתר עד שהכפתור מצויר, ולכן הרוחב נמדד מההורה
    width: Math.max(200, Math.min(400, Math.round(el.clientWidth || el.parentElement?.clientWidth || 300))),
  });
}
