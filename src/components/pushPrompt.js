/* הבאנר "דמות מהתנ״ך כל ערב" - בקשה לאשר התראה יומית, בכל המסכים.

   למה באנר שלנו ולא חלון הרשות של הדפדפן מיד בכניסה: חלון שקופץ לפני שהגולש
   ראה משהו נחסם ברוב המקרים, וחסימה היא סופית - אי אפשר לבקש שוב. ו-Chrome
   מסתיר את הבקשה של אתר שרבים חוסמים, מכולם. לכן קודם באנר, ורק "כן" פותח את
   חלון הדפדפן.

   מתי: רק אחרי שהגולש פתח בעצמו כרטיס - דמות, מקום, מפת מסע, או סיים סבב במשחק
   (האירוע si:engaged מ-lib/trail.js) - ולא בכניסה לאתר (בקשת בעל האתר). כרטיס
   שנפתח לבד בטעינה, מקישור עם ?sel=, לא נחשב. פעם אחת לטעינה. "לא עכשיו" שקט לשלושה
   שבועות. לא מוצג למי שכבר נרשם או חסם, ולא בבדיקות אוטומטיות (webdriver) -
   שער האיכות לוחץ על כפתורים, ובאנר צף היה מסתיר אותם.

   אייפון בספארי רגיל: אין שם התראות כלל, רק מהאייקון במסך הבית - ולכן הבאנר
   מסביר איך מוסיפים, במקום לבקש רשות.

   הסגנון בבעלות הרכיב (pushPrompt.css), כמו siteMenu: הוא מגיע לארבעה מסכים. */
import './pushPrompt.css';
import { mark } from '../lib/trail.js';
import { canPush, iosNeedsInstall, isSubscribed, subscribe, unsubscribe } from '../lib/push.js';

const NO_KEY = 'si_push_no';
const QUIET_DAYS = 21;
const TITLE = '🔔 דמות מהתנ״ך כל ערב';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* מתעלמים */ } },
};

let box = null;
function render(state) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'pp';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'התראה יומית');
    document.body.appendChild(box);
  }
  const V = {
    ask: [TITLE, 'התראה אחת ביום לטלפון: דמות או אירוע מתולדות ישראל. בלי הרשמה ובלי מייל, ואפשר לבטל בכל רגע.',
      [['yes', 'כן, אשמח', 1], ['no', 'לא עכשיו']]],
    ios: [TITLE, 'באייפון ההתראות עובדות מהאייקון של האתר: לחצו על כפתור השיתוף ⬆️, בחרו "הוספה למסך הבית", ופתחו את האתר משם.',
      [['no', 'הבנתי', 1]]],
    busy: [TITLE, 'מאשרים בדפדפן…', []],
    ok: ['✓ נרשמתם', 'התראת ניסיון בדרך אליכם, ומחר בערב - הדמות הראשונה.', [['close', 'סגירה']]],
    denied: ['ההתראות חסומות', 'הדפדפן חוסם התראות מהאתר. כדי לאפשר: לחצו על המנעול 🔒 ליד הכתובת ← הרשאות ← התראות.', [['close', 'סגירה']]],
    dismissed: [TITLE, 'החלון נסגר בלי אישור. אפשר לנסות שוב בכל זמן מהתפריט "עוד באתר".', [['close', 'סגירה']]],
    error: ['משהו השתבש', 'ההרשמה לא הצליחה. אפשר לנסות שוב מהתפריט "עוד באתר".', [['close', 'סגירה']]],
    on: ['🔔 ההתראה היומית פעילה', 'כל ערב תגיע מכאן דמות או אירוע מתולדות ישראל.', [['off', 'ביטול ההתראות'], ['close', 'סגירה', 1]]],
    off: ['ההתראות בוטלו', 'לא יגיעו יותר התראות מהאתר למכשיר הזה.', [['close', 'סגירה']]],
    none: ['אין התראות בדפדפן הזה', 'הדפדפן הזה לא תומך בהתראות מאתרים. נסו מ-Chrome או מהאפליקציה במסך הבית.', [['close', 'סגירה']]],
  }[state];
  const [h, p, btns] = V;
  box.innerHTML = `<button type="button" class="pp-x" data-a="${state === 'ask' || state === 'ios' ? 'no' : 'close'}" aria-label="סגירה">✕</button>`
    + `<b class="pp-h">${h}</b><p class="pp-p">${p}</p>`
    + (btns.length ? `<div class="pp-b">${btns.map(([a, t, main]) => `<button type="button" data-a="${a}"${main ? ' class="main"' : ''}>${t}</button>`).join('')}</div>` : '');
  box.hidden = false;
  box.onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a) act(a, state);
  };
  if (state === 'ok') setTimeout(() => { if (box && !box.hidden) close(); }, 9000);
}

function close() { if (box) box.hidden = true; }

async function act(a, state) {
  if (a === 'close') return close();
  if (a === 'no') {
    ls.set(NO_KEY, String(Date.now()));
    mark('push_prompt', { r: state === 'ios' ? 'ios-ok' : 'no' });
    return close();
  }
  if (a === 'yes') {
    mark('push_prompt', { r: 'yes' });
    render('busy');
    const r = await subscribe();
    mark('push_sub', { r });
    return render(r);
  }
  if (a === 'off') {
    await unsubscribe();
    mark('push_off');
    return render('off');
  }
}

/** מהתפריט "עוד באתר": תמיד נפתח, ומראה את המצב הנוכחי */
export async function openPushPanel() {
  if (iosNeedsInstall()) return render('ios');
  if (!canPush()) return render('none');
  if (await isSubscribed()) return render('on');
  if (Notification.permission === 'denied') return render('denied');
  return render('ask');
}

/** נקרא פעם אחת בכל מסך. מחליט אם ומתי להציע */
export function initPushPrompt() {
  if (typeof window === 'undefined' || navigator.webdriver) return;
  const quiet = Number(ls.get(NO_KEY) || 0);
  if (quiet && Date.now() - quiet < QUIET_DAYS * 864e5) return;
  const kind = canPush() ? (Notification.permission === 'default' ? 'ask' : null) : (iosNeedsInstall() ? 'ios' : null);
  if (!kind) return;

  let done = false;
  const show = async () => {
    if (done) return;
    // חלון פתוח (מדריך, התחברות במשחק) - מחכים שייסגר
    if (document.querySelector('dialog[open]')) { setTimeout(show, 4000); return; }
    done = true;
    window.removeEventListener('si:engaged', soon);
    /* השרת מוכן? (המפתח הציבורי מתקבל; הדפדפן שומר אותו שעה.) בלי זה, לפני
       שהטבלאות נוצרו או בתקלה, גולש היה מאשר התראות ומקבל שגיאה */
    if (kind === 'ask') {
      const ready = await fetch('/api/push').then((r) => r.ok).catch(() => false);
      if (!ready) return;
    }
    mark('push_prompt', { r: kind === 'ios' ? 'ios' : 'shown' });
    render(kind);
  };
  /* רגע אחרי הפעולה ולא מיד: מי שפתח כרטיס צריך לראות אותו לפני שמבקשים ממנו
     משהו. אירוע בשלוש השניות הראשונות הוא כרטיס שנפתח לבד מהקישור - לא נחשב */
  const t0 = Date.now();
  const soon = () => {
    if (Date.now() - t0 < 3000) return;
    window.removeEventListener('si:engaged', soon);
    setTimeout(show, 5000);
  };
  window.addEventListener('si:engaged', soon);
}

export const pushMenuVisible = () => canPush() || iosNeedsInstall();
