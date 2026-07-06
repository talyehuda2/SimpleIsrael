import { formatRange } from '../utils/dates.js';
import maps from '../data/maps.json';

const KIND_LABELS = {
  leader: 'מנהיג',
  judge: 'שופט',
  united: 'מלך — הממלכה המאוחדת',
  judah: 'מלך יהודה',
  israel: 'מלך ישראל',
  prophet: 'נביא',
  book: 'ספר',
  event: 'אירוע',
};

const JUDGMENT_LABELS = {
  good: 'עשה הישר בעיני ה\'',
  bad: 'עשה הרע בעיני ה\'',
  mixed: 'מעורב',
};

export default function DetailCard({ item, mode, onClose, onOpenMap }) {
  if (!item) return null;
  const hasMap = !!maps[item.id];
  return (
    <aside className="detail-card">
      <button className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>
      <div className={`kind-chip ${item.kind}`}>{KIND_LABELS[item.kind]}</div>
      <h2>{item.name}</h2>
      <div className="detail-years">{formatRange(item.start, item.end, mode)}</div>
      {item.reignText && <div className="detail-row"><b>משך המלוכה:</b> {item.reignText}</div>}
      {item.lifeText && <div className="detail-row"><b>שנות חיים:</b> {item.lifeText}</div>}
      {item.tenureText && <div className="detail-row"><b>הנהגה:</b> {item.tenureText}</div>}
      {item.kings && <div className="detail-row"><b>בימי:</b> {item.kings}</div>}
      {item.judgment && (
        <div className={`judgment-chip ${item.judgment}`}>{JUDGMENT_LABELS[item.judgment]}</div>
      )}
      <p className="detail-desc">{item.description}</p>
      {hasMap && (
        <button className="map-btn" onClick={() => onOpenMap(item)}>
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
            <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
          מפת המקומות
        </button>
      )}
      {item.source && <div className="detail-source"><b>מקור:</b> {item.source}</div>}
    </aside>
  );
}
