/* "שתי הממלכות" של ציר הזמן, מורכב לתוך מסע הדורות.

   אותו רכיב בדיוק, ולא עותק שני בוונילה: הסגנון נמצא ב-KingsChart.css
   שהרכיב מייבא בעצמו, ולכן הוא מגיע לשני המסכים יחד עם הקוד. אילן
   היוחסין, לעומת זאת, כתוב פעמיים - פעם כרכיב React ופעם כאן ב-main.js
   - ושני העותקים צריכים תיקון נפרד בכל שינוי. */
import { createRoot } from 'react-dom/client';
import KingsChart from '../components/KingsChart.jsx';

let root = null;
let jump = () => {};

function draw(open) {
  let host = document.querySelector('#kingsHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'kingsHost';
    document.body.appendChild(host);
  }
  if (!root) root = createRoot(host);
  root.render(<KingsChart open={open} onClose={() => draw(false)} onJump={jump} />);
}

export const closeKings = () => draw(false);
export const openKings = (onJump) => { jump = onJump; draw(true); };
