import { createRoot } from 'react-dom/client';
import JourneyMap from '../components/JourneyMap.jsx';
import { ALL_ITEMS, itemKey } from '../data/items.js';
import maps from '../data/maps.json';

/* מסע הדורות מרנדר את אותה מפה של ציר הזמן. הלוגיקה שהייתה כאן - מצלמת
   CSS transform, fitMap, zoomTo, paint ובקרות ההשמעה - הוחלפה כולה
   ברכיב המשותף, ולכן קצב ההשמעה וההיטל זהים בשני המסכים בהגדרה. */

let root = null;

export function renderMap(key, opts = {}) {
  const host = document.querySelector('#jmHost');
  if (!host) return;
  if (!root) root = createRoot(host);
  const item = key && ALL_ITEMS.find((x) => itemKey(x) === key);
  if (!item || !maps[item.id]) {
    // פריט בלי מסע - מציגים הודעה במקום מפה ריקה
    root.render(
      <div className="jm-none">
        <span aria-hidden="true">🗺️</span>
        <p>{item ? `אין מסע מתועד ל${item.name}` : 'בחרו דמות או אירוע כדי לראות את מסעו'}</p>
      </div>
    );
    return;
  }
  root.render(<JourneyMap item={item} variant="atlas" onClose={opts.onClose} />);
}
