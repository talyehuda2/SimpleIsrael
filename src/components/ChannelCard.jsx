/* כרטיס-הקישור לערוץ הוואטסאפ, לשני מסכי ה-React (ציר הזמן והמשחק).
   אותו מבנה של channelCardHtml, שמשמש את המסכים שאינם React - ראו
   channel.js, שם גם המדידה (data-ch) והסגנון. */
import { CHANNEL_URL, CHANNEL_TAG } from './channel.js';

export default function ChannelCard({ from, title = 'הערוץ שלנו בוואטסאפ', tag = CHANNEL_TAG }) {
  return (
    <a className="ch-card" href={CHANNEL_URL} target="_blank" rel="noopener" data-ch={from}>
      <span className="ch-ico" aria-hidden="true">📢</span>
      <span className="ch-t"><b>{title}</b><span>{tag}</span></span>
      <span className="ch-go" aria-hidden="true">←</span>
    </a>
  );
}
