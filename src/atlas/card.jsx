import { createRoot } from 'react-dom/client';
import '../styles.css';   // אותו גיליון של ציר הזמן - כך הכרטיס נראה זהה
import DetailCard from '../components/DetailCard.jsx';
import { ALL_ITEMS, itemKey, overlaps, collectionsOf } from '../data/items.js';
import { fetchCommentCounts } from '../lib/commentCounts.js';

/* מסע הדורות מרנדר את אותו רכיב כרטיס של ציר הזמן. כל שינוי בכרטיס מופיע
   מיד בשני המסכים - זו הסיבה שהעמוד הזה הפך ל-entry של Vite. */

const AXIS = { start: 1940, end: 3850 };
const MAX_CONTEMP = 20;

let root = null;
let counts = {};
fetchCommentCounts().then((c) => { counts = c; repaint(); });

// מצב אחרון שהוצג, כדי שנוכל לצייר מחדש כשמונה התגובות מגיע
let last = null;

const contemporariesOf = (it) => ALL_ITEMS
  .filter((o) => !(o.kind === it.kind && o.id === it.id) && overlaps(it, o))
  .sort((a, b) => a.start - b.start)
  .slice(0, MAX_CONTEMP);

function repaint() {
  if (last) renderCard(last);
}

/**
 * @param {object} o
 * @param {string} o.key      מזהה הפריט בצורת kind:id
 * @param {object} o.prev     הפריט הקודם ברשימה הגלויה (או null)
 * @param {object} o.next     הפריט הבא
 * @param {(item:object)=>void} o.onNav   ניווט לפריט אחר בתוך המסע
 * @param {()=>void} [o.onClose]          סגירת הגיליון (מובייל בלבד)
 * @param {(c:object)=>void} [o.onOpenCollection]  פתיחת אוסף תמטי
 * @param {boolean} [o.openComments]
 */
export function renderCard(o) {
  last = o;
  const host = document.querySelector('#dcHost');
  if (!host) return;
  if (!root) root = createRoot(host);
  const item = ALL_ITEMS.find((x) => itemKey(x) === o.key);
  if (!item) { root.render(null); return; }
  root.render(
    <DetailCard
      item={item}
      variant="atlas"
      onClose={o.onClose}
      onOpenMap={o.onOpenMap}
      prevItem={o.prev} nextItem={o.next}
      onNav={o.onNav}
      axisStart={AXIS.start} axisEnd={AXIS.end}
      contemporaries={contemporariesOf(item)}
      collections={collectionsOf(item.id)}
      onOpenCollection={o.onOpenCollection}
      commentCount={counts[o.key] || 0}
      switchHref={`/?sel=${o.key}`} switchLabel="ציר הזמן"
      openComments={o.openComments}
    />
  );
}

export function clearCard() {
  last = null;
  if (root) root.render(null);
}
