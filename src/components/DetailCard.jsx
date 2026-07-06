import { formatRange } from '../utils/dates.js';

const KIND_LABELS = {
  leader: 'מנהיג',
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

export default function DetailCard({ item, mode, onClose }) {
  if (!item) return null;
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
      {item.source && <div className="detail-source"><b>מקור:</b> {item.source}</div>}
    </aside>
  );
}
