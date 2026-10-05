/* חשבון שחקן ב"סדר את הציר": התחברות, כינוי, נקודות וטבלה.

   נטען בעצלות (import דינמי) - ורק כשיש סיבה: שחקן שכבר התחבר במכשיר הזה,
   חזרה מגוגל, או לחיצה על "התחברות". אורח שרק משחק לא מוריד את supabase-js.

   לקוח Supabase נפרד מזה של התגובות (lib/supabase.js), ובכוונה: שם
   persistSession כבוי, כי תגובה אינה דורשת זהות. כאן ההתחברות נשמרת
   בדפדפן תחת מפתח משלה, כדי ששני הלקוחות לא ידרכו זה על זה.

   שתי דרכי התחברות:
   - **קוד במייל** ולא קישור קסם. באייפון קישור במייל נפתח לרוב בדפדפן של
     אפליקציית המייל, וההתחברות נשארת שם ולא בספארי שבו המשחק פתוח. קוד בן
     שש ספרות מוקלד באותו דף, ועובד בכל מכשיר.
   - **גוגל**, בהפניה (redirect) ולא בחלון קופץ: COOP same-origin של האתר
     מנתק חלון קופץ מהדף שפתח אותו, וספארי חוסם חלונות קופצים ממילא. */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseConfig.js';
import { AUTH_KEY } from './board.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: AUTH_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/* הודעות השגיאה של Supabase באנגלית. מה שהשחקן עלול לראות מתורגם, ומה
   שבא מהפונקציות שלנו כבר בעברית ועובר כמו שהוא. */
export function errText(e) {
  const m = e?.message || String(e || '');
  if (/[א-ת]/.test(m)) return m.replace(/^.*?:\s*(?=[א-ת])/, '');
  if (/rate limit|too many|security purposes/i.test(m)) return 'יותר מדי ניסיונות. נסו שוב בעוד דקה.';
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(m)) return 'הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.';
  if (/invalid.*email|email.*invalid/i.test(m)) return 'כתובת המייל אינה תקינה.';
  if (/fetch|network/i.test(m)) return 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.';
  return 'משהו השתבש. נסו שוב.';
}

export async function accessToken() {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || null;
}

export async function sendCode(email) {
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${location.origin}/game` },
  });
  if (error) throw error;
}

export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data.user;
}

export async function signInGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/game?src=google`, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

// האישור מהכפתור של גוגל (google.js) - בלי הפניה דרך השרת של Supabase
export async function signInGoogleToken(token, nonce) {
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token, nonce });
  if (error) throw error;
}

export const signOut = () => sb.auth.signOut();

async function rpc(name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}

export const me = () => rpc('game_me');
export const setNickname = (nickname) => rpc('game_set_nickname', { p_nickname: nickname });
export const deleteMe = async () => { await rpc('game_delete_me'); await sb.auth.signOut({ scope: 'local' }); };

/* שליחת הסדר לשרת, שמחשב את הציון ושומר אותו (api/game.js). מחזיר את
   מה שנשמר: אם כבר נשלח היום ממכשיר אחר - את התוצאה ההיא ולא את זו. */
export async function submitDaily(day, placed) {
  const token = await accessToken();
  if (!token) throw new Error('נדרשת התחברות');
  const r = await fetch('/api/game', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, placed }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'השמירה נכשלה');
  return body;
}
