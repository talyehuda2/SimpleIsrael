/* ערוץ הוואטסאפ "ציר הזמן של עם ישראל" - מקור אחד לקישור, לכיתוב ולסגנון.

   מופיע בשלושה מקומות: תפריט "עוד באתר" (שלושת המסכים), חלונית "אודות"
   (שלושת המסכים) ומסך התוצאה של האתגר היומי, ובנוסף שורת "המנצחים
   מתפרסמים בערוץ" בטבלת המובילים (Account.jsx). קישור רגיל בלבד - בלי
   סקריפט או וידג'ט של וואטסאפ, ולכן אין צד שלישי חדש ואין שינוי בעמוד
   הפרטיות.

   מדידה: וואטסאפ לא מספר מאיזה קישור הגיע מצטרף, ולכן כל לחיצה נרשמת
   כאן - channel_click {from}. כל קישור שנושא data-ch נספר, בלי מאזין
   משלו: מאזין אחד על המסמך, שנרשם בטעינת המודול. כך גם HTML שנבנה
   כמחרוזת (מסע הדורות, מפת הארץ) נספר בלי חיווט.

   הסגנון בבעלות הרכיב (channel.css) - הוא מגיע לשלושה גיליונות שונים. */
import './channel.css';
import { mark } from '../lib/trail.js';

export const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb95vDvKAwElqCPM8T2L';
export const CHANNEL_NAME = 'ציר הזמן של עם ישראל';
// אותה שורה שמתחת לשם הערוץ בתמונות הסטטוס (scripts/status.mjs)
export const CHANNEL_TAG = 'דמות מהתנ״ך מדי פעם, ישר לטלפון';

if (typeof document !== 'undefined' && !window.__siChannel) {
  window.__siChannel = true;
  // capture: גם אם מאזין אחר עוצר את האירוע בדרך
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-ch]');
    if (a) mark('channel_click', { from: a.dataset.ch });
  }, true);
}

/* כרטיס-קישור: שם הערוץ והשורה שמתחתיו. from - מאיפה נלחץ, למדידה */
export function channelCardHtml(from) {
  return `<a class="ch-card" href="${CHANNEL_URL}" target="_blank" rel="noopener" data-ch="${from}">`
    + '<span class="ch-ico" aria-hidden="true">📢</span>'
    + `<span class="ch-t"><b>הערוץ שלנו בוואטסאפ</b><span>${CHANNEL_TAG}</span></span>`
    + '<span class="ch-go" aria-hidden="true">←</span></a>';
}
