/* תפריט "עוד באתר" - המקום היחיד שבו רשומים הפיצ'רים הנוספים של האתר.

   עד עכשיו כל פיצ'ר היה כפתור משלו בסרגל העליון, ובשלושה עותקים: ב-JSX של
   ציר הזמן וב-HTML של מסע הדורות ומפת הארץ. הסרגל התמלא (בטלפון - שמונה
   אייקונים ב-360px), וכל פיצ'ר חדש דרש שלושה שינויים. עכשיו הסרגל שומר רק
   את מה שצריך תמיד בהישג יד - אודות ומדריך מימין, הערה למנהל ושיתוף משמאל -
   וכל השאר כאן. פיצ'ר חדש = שורה אחת ב-ITEMS, והוא מופיע בכל המסכים.

   vanilla ולא React, כי שניים משלושת המסכים אינם React. ציר הזמן מרכיב
   אותו מתוך useEffect.

   הסגנון בבעלות הרכיב (siteMenu.css), לפי הדפוס של NotesBox: רכיב שמגיע
   לשלושה מסכים לא יכול להסתמך על גיליון של אחד מהם. */
import './siteMenu.css';
import { mark } from '../lib/trail.js';
import { CHANNEL_URL, CHANNEL_TAG } from './channel.js';

/* action: מזהה פעולה שהמסך יכול לבצע במקום (פתיחת חלונית). מסך שאין לו
   את הפעולה מקבל קישור - href - שפותח אותה בציר הזמן. */
const ITEMS = [
  { id: 'tours', icon: '🧭', title: 'מסעות ואוספים', desc: 'סיור מודרך דמות אחר דמות, ואוספים לפי נושא', href: '/?tours=1' },
  { id: 'tree', icon: '👑', title: 'בית דוד', desc: 'אילן היוחסין של מלכי בית דוד', href: '/?tree=1' },
  { id: 'kings', icon: '🏰', title: 'שתי הממלכות', desc: 'מלכי יהודה מול מלכי ישראל, לפי אורך המלוכה', href: '/?kings=1' },
  { id: 'game', icon: '🎯', title: 'סדר את הציר', desc: 'משחק: מה קרה קודם? אתגר יומי ומשחק חופשי', href: '/game', badge: 'חדש' },
  // ext: יוצא מהאתר - נפתח בלשונית חדשה, ונספר גם כ-channel_click (data-ch)
  { id: 'channel', icon: '📢', title: 'הערוץ בוואטסאפ', desc: CHANNEL_TAG, href: CHANNEL_URL, ext: 'menu' },
];

let seq = 0;

/* host - אלמנט שבו יושב הכפתור. actions - { tours: fn, ... } לפעולות שהמסך
   מבצע בעצמו. מחזיר פונקציית ניקוי. */
export function mountSiteMenu(host, { actions = {} } = {}) {
  const id = `sm-panel-${++seq}`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sm-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', id);
  btn.setAttribute('aria-haspopup', 'true');
  btn.title = 'עוד באתר: מסעות, בית דוד, שתי הממלכות, המשחק ועוד';
  btn.innerHTML = '<span class="sm-ico" aria-hidden="true">☰</span><span class="sm-l">עוד באתר</span>';
  host.appendChild(btn);

  /* הלוח יושב ב-body ולא בתוך הסרגל: בטלפון לסרגל של מסע הדורות יש
     overflow:hidden, ולוח שבתוכו היה נחתך. המיקום מחושב מהכפתור. */
  const panel = document.createElement('div');
  panel.id = id;
  panel.className = 'sm-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'עוד באתר');
  const list = document.createElement('ul');
  list.className = 'sm-list';
  for (const it of ITEMS) {
    const li = document.createElement('li');
    const act = actions[it.id];
    const el = document.createElement(act ? 'button' : 'a');
    el.className = 'sm-item';
    if (act) el.type = 'button'; else el.href = it.href;
    if (it.ext) { el.target = '_blank'; el.rel = 'noopener'; el.dataset.ch = it.ext; }
    el.innerHTML = `<span class="sm-i" aria-hidden="true">${it.icon}</span>`
      + `<span class="sm-t"><span class="sm-h"><b>${it.title}</b>${it.badge ? `<span class="sm-badge">${it.badge}</span>` : ''}</span>`
      + `<span class="sm-d">${it.desc}</span></span>`;
    // menu_pick: מה בוחרים מהתפריט - כך רואים אם פיצ'ר שהוסתר מהסרגל עוד נמצא
    el.addEventListener('click', () => { mark('menu_pick', { id: it.id }); close(false); if (act) act(); });
    li.appendChild(el);
    list.appendChild(li);
  }
  panel.appendChild(list);
  document.body.appendChild(panel);

  function place() {
    const r = btn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = Math.min(360, vw - 16);
    panel.style.width = `${w}px`;
    panel.style.top = `${Math.round(r.bottom + 8)}px`;
    // ממורכז מתחת לכפתור, ונצמד לשולי המסך כשאין מקום
    const left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2));
    panel.style.left = `${Math.round(left)}px`;
  }
  function open() {
    place();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('on');
    panel.querySelector('.sm-item')?.focus();
  }
  function close(refocus = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('on');
    if (refocus) btn.focus();
  }
  const onBtn = () => (panel.hidden ? open() : close());
  const onDoc = (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close(false); };
  const onKey = (e) => { if (e.key === 'Escape' && !panel.hidden) close(); };
  const onResize = () => close(false);

  btn.addEventListener('click', onBtn);
  document.addEventListener('pointerdown', onDoc);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);

  return () => {
    btn.removeEventListener('click', onBtn);
    document.removeEventListener('pointerdown', onDoc);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    btn.remove();
    panel.remove();
  };
}
