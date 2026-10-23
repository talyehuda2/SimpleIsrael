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

   במשחק (אוקטובר 2026) ההצעה היא תזכורת לאתגר היומי ב-21:00 ({ game: true }): מי שלא
   נרשם - נרשם לתזכורת בלבד; מי שכבר מקבל דמות יומית - מתבקש להוסיף אותה. ההעדפות
   (דמות יומית ותזכורת) נבחרות באותה חלונית, וכאן גם בתפריט "עוד באתר".

   הסגנון בבעלות הרכיב (pushPrompt.css), כמו siteMenu: הוא מגיע לארבעה מסכים. */
import './pushPrompt.css';
import { mark } from '../lib/trail.js';
import {
  canPush, iosNeedsInstall, isSubscribed, subscribe, unsubscribe, getPrefs, setPrefs, markPlayed, gameReady,
} from '../lib/push.js';
import { sendAllowed, FREQS } from '../lib/holy.js';

const NO_KEY = 'si_push_no';
const GAME_NO_KEY = 'si_push_game_no';
const QUIET_DAYS = 21;
const TITLE = '🔔 דמות מהתנ״ך, ישר לטלפון';
const GAME_TITLE = '🎯 תזכורת לאתגר היומי';
// מתחת לבחירה: למה אין בשבת, ומתי בכל זאת יוצא בסוף השבוע (src/lib/holy.js)
const HOLY_NOTE = 'הכל ב-21:00, בלי שבת וחג: בשישי בצהריים, ובמוצאי שבת מ-21:00.';
const PREFS_EVENT = 'si:push-prefs';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* מתעלמים */ } },
};
const quiet = (k) => { const t = Number(ls.get(k) || 0); return t && Date.now() - t < QUIET_DAYS * 864e5; };

let box = null;
let ctx = {};
function render(state) {
  if (!box) {
    box = document.createElement('div');
    box.className = 'pp';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'התראה יומית');
    document.body.appendChild(box);
  }
  const g = !!ctx.game;
  const V = {
    ask: g
      ? [GAME_TITLE, 'כל ערב ב-21:00 נזכיר לכם את האתגר - רק אם עוד לא פתרתם אותו. בלי הרשמה ובלי מייל, ואפשר לבטל בכל רגע.',
        [['yes', 'כן, תזכירו לי', 1], ['no', 'לא עכשיו']]]
      : [TITLE, 'דמות או אירוע מתולדות ישראל - כל יום, או בתדירות שתבחרו. בלי הרשמה ובלי מייל, ואפשר לבטל בכל רגע.',
        [['yes', 'כן, אשמח', 1], ['no', 'לא עכשיו']]],
    add: [GAME_TITLE, 'אתם כבר מקבלים מאיתנו התראות. להוסיף תזכורת לאתגר ב-21:00, רק בימים שעוד לא פתרתם אותו?',
      [['add', 'כן, תוסיפו', 1], ['no', 'לא עכשיו']]],
    ios: [g ? GAME_TITLE : TITLE, `באייפון ההתראות עובדות מהאייקון של האתר: לחצו על כפתור השיתוף ⬆️, בחרו "הוספה למסך הבית", ופתחו את האתר משם${g ? ' - ואז את המשחק' : ''}.`,
      [['no', 'הבנתי', 1]]],
    busy: [g ? GAME_TITLE : TITLE, 'מאשרים בדפדפן…', []],
    ok: ['✓ נרשמתם', `${g ? 'נזכיר לכם ב-21:00 בכל יום שעוד לא שיחקתם. ' : ''}${sendAllowed() ? 'התראת ניסיון בדרך אליכם.' : 'בשבת ובחג לא יוצאות התראות - הראשונה תגיע אחריהם.'}${g ? '' : ' כמה פעמים תרצו לקבל?'}`,
      [['close', 'סגירה']]],
    added: ['✓ התזכורת הופעלה', 'נזכיר לכם את האתגר ב-21:00, בימים שעוד לא פתרתם אותו. מה עוד תרצו לקבל?', [['close', 'סגירה', 1]]],
    denied: ['ההתראות חסומות', 'הדפדפן חוסם התראות מהאתר. כדי לאפשר: לחצו על המנעול 🔒 ליד הכתובת ← הרשאות ← התראות.', [['close', 'סגירה']]],
    dismissed: [g ? GAME_TITLE : TITLE, 'החלון נסגר בלי אישור. אפשר לנסות שוב בכל זמן מהתפריט "עוד באתר".', [['close', 'סגירה']]],
    error: ['משהו השתבש', 'ההרשמה לא הצליחה. אפשר לנסות שוב מהתפריט "עוד באתר".', [['close', 'סגירה']]],
    on: ['🔔 ההתראות פעילות', 'מה תרצו לקבל?', [['off', 'ביטול ההתראות'], ['close', 'סגירה', 1]]],
    off: ['ההתראות בוטלו', 'לא יגיעו יותר התראות מהאתר למכשיר הזה.', [['close', 'סגירה']]],
    none: ['אין התראות בדפדפן הזה', 'הדפדפן הזה לא תומך בהתראות מאתרים. נסו מ-Chrome או מהאפליקציה במסך הבית.', [['close', 'סגירה']]],
  }[state];
  const [h, p, btns] = V;
  const prefs = state === 'ok' || state === 'on' || state === 'added';
  box.innerHTML = `<button type="button" class="pp-x" data-a="${['ask', 'ios', 'add'].includes(state) ? 'no' : 'close'}" aria-label="סגירה">✕</button>`
    + `<b class="pp-h">${h}</b><p class="pp-p">${p}</p>`
    + (prefs ? `<div class="pp-prefs" hidden>`
      + `<div class="pp-g" hidden><span class="pp-l">🎯 תזכורת לאתגר היומי</span><div class="pp-f two" role="group" aria-label="תזכורת לאתגר">`
      + `<button type="button" data-g="1" aria-pressed="false">כן</button><button type="button" data-g="0" aria-pressed="false">לא</button></div></div>`
      + `<span class="pp-l">📜 דמות או אירוע מהתנ״ך</span><div class="pp-f" role="group" aria-label="תדירות">`
      + `${FREQS.map(([f, t]) => `<button type="button" data-f="${f}" aria-pressed="false">${t}</button>`).join('')}`
      + `<button type="button" data-f="none" class="pp-none" aria-pressed="false" hidden>בלי</button></div>`
      + `<p class="pp-n">${HOLY_NOTE}</p></div>` : '')
    + (btns.length ? `<div class="pp-b">${btns.map(([a, t, main]) => `<button type="button" data-a="${a}"${main ? ' class="main"' : ''}>${t}</button>`).join('')}</div>` : '');
  box.hidden = false;
  box.onclick = (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.f) return pick({ freq: b.dataset.f });
    if (b?.dataset.g) return pick({ game: b.dataset.g === '1' });
    if (b?.dataset.a) act(b.dataset.a, state);
  };
  if (prefs) showPrefs();
}

/* ההעדפות נטענות מהמסד ומוצגות רק אם הגיעו. בלי push_freq.sql - לא מוצגות וכולם כל
   יום; בלי push_game.sql - רק התדירות, בלי שורת התזכורת ובלי "בלי" */
let cur = null;
function paint() {
  box.querySelectorAll('.pp-f button[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === cur.freq)));
  box.querySelectorAll('.pp-f button[data-g]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.g === '1') === !!cur.game)));
}
async function showPrefs() {
  cur = await getPrefs();
  if (!cur || !box) return;
  const withGame = cur.game !== null && cur.game !== undefined;
  box.querySelector('.pp-g').hidden = !withGame;
  box.querySelector('.pp-none').hidden = !withGame;
  paint();
  box.querySelector('.pp-prefs').hidden = false;
}
async function pick(change) {
  if (!cur) return;
  const prev = cur;
  cur = { ...cur, ...change };
  paint();
  if (await setPrefs(change)) {
    if (change.freq) mark('push_freq', { f: change.freq });
    if (change.game !== undefined) mark('push_game', { on: change.game ? 1 : 0, via: 'prefs' });
    window.dispatchEvent(new Event(PREFS_EVENT));
  } else { cur = prev; paint(); }
}

function close() { if (box) box.hidden = true; }

async function act(a, state) {
  if (a === 'close') return close();
  if (a === 'no') {
    ls.set(ctx.game ? GAME_NO_KEY : NO_KEY, String(Date.now()));
    mark('push_prompt', { r: state === 'ios' ? 'ios-ok' : 'no', game: ctx.game ? 1 : 0 });
    return close();
  }
  if (a === 'yes') {
    mark('push_prompt', { r: 'yes', game: ctx.game ? 1 : 0 });
    render('busy');
    const r = await subscribe({ game: !!ctx.game });
    mark('push_sub', { r, game: ctx.game ? 1 : 0 });
    if (r === 'ok' && ctx.game) gameOn();
    return render(r);
  }
  if (a === 'add') {
    mark('push_prompt', { r: 'add', game: 1 });
    if (!(await setPrefs({ game: true }))) return render('error');
    gameOn();
    return render('added');
  }
  if (a === 'off') {
    await unsubscribe();
    mark('push_off');
    window.dispatchEvent(new Event(PREFS_EVENT));
    return render('off');
  }
}

// מי שהפעיל תזכורת מתוך מסך התוצאה כבר פתר היום - שלא יקבל תזכורת הערב
function gameOn() {
  mark('push_game', { on: 1, via: 'offer' });
  if (ctx.played) markPlayed(ctx.played);
  window.dispatchEvent(new Event(PREFS_EVENT));
}

/** מהתפריט "עוד באתר" (בלי ארגומנטים) או מהמשחק ({ game: true, played: יום }).
    תמיד נפתח, ומראה את המצב הנוכחי */
export async function openPushPanel(opts) {
  ctx = opts && opts.game ? opts : {};
  if (iosNeedsInstall()) return render('ios');
  if (!canPush()) return render('none');
  if (await isSubscribed()) {
    if (ctx.game && (await getPrefs())?.game === false) return act('add', 'add');
    return render('on');
  }
  if (Notification.permission === 'denied') return render('denied');
  return render('ask');
}

/** נקרא פעם אחת בכל מסך. מחליט אם ומתי להציע. במשחק: { game: true } */
export function initPushPrompt(opts = {}) {
  if (typeof window === 'undefined' || navigator.webdriver) return;
  const game = !!opts.game;
  if (quiet(game ? GAME_NO_KEY : NO_KEY)) return;
  if (!canPush() && !iosNeedsInstall()) return;

  let done = false;
  const show = async () => {
    if (done) return;
    // חלון פתוח (מדריך, התחברות במשחק) - מחכים שייסגר
    if (document.querySelector('dialog[open]')) { setTimeout(show, 4000); return; }
    done = true;
    window.removeEventListener('si:engaged', soon);
    let kind = null;
    if (iosNeedsInstall()) kind = 'ios';
    else if (Notification.permission === 'default') kind = 'ask';
    else if (game && await isSubscribed() && (await getPrefs())?.game === false) kind = 'add';
    if (!kind) return;
    /* השרת מוכן? בלי זה, לפני שהטבלאות נוצרו או בתקלה, גולש היה מאשר התראות ומקבל
       שגיאה. במשחק - גם push_game.sql, אחרת "תזכורת" הייתה נרשמת כדמות יומית */
    if (kind !== 'ios') {
      const ready = await fetch('/api/push').then((r) => r.ok).catch(() => false);
      if (!ready || (game && !(await gameReady()))) return;
    }
    ctx = game ? { game: true, played: opts.played?.() } : {};
    mark('push_prompt', { r: kind === 'ios' ? 'ios' : kind === 'add' ? 'add-shown' : 'shown', game: game ? 1 : 0 });
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
export { PREFS_EVENT };
