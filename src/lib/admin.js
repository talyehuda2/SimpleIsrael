// מצב ניהול: טוקן שנשמר רק בדפדפן של המנהל (localStorage) ולעולם לא בקוד האתר.
// המחיקה עצמה מתבצעת בפונקציה בצד השרת (admin_delete_comment) שמאמתת את הטוקן,
// כך שגם מי שיקרא את קוד האתר לא יוכל למחוק דבר.
const KEY = 'si_admin_token';

export function getAdminToken() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* מתעלמים */ }
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
