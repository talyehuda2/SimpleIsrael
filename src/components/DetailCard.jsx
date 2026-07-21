import { lazy, Suspense, useEffect, useState } from 'react';
import { formatRange } from '../utils/dates.js';
import { shareLink, itemPageUrl } from '../lib/share.js';
import { sourceSegments } from '../utils/sefaria.js';
import maps from '../data/maps.json';

// נטען רק כשנפתח כרטיס — כך ספריית Supabase לא מכבידה על טעינת הציר
const Comments = lazy(() => import('./Comments.jsx'));

const KIND_LABELS = {
  leader: 'מנהיג',
  judge: 'שופט',
  united: 'מלך — הממלכה המאוחדת',
  judah: 'מלך יהודה',
  israel: 'מלך ישראל',
  prophet: 'נביא',
  book: 'ספר',
  event: 'אירוע',
  world: 'רקע עולמי',
  empire: 'מלכות עולמית',
};

const JUDGMENT_LABELS = {
  good: 'עשה הישר בעיני ה\'',
  bad: 'עשה הרע בעיני ה\'',
  mixed: 'מעורב',
};

export default function DetailCard({ item, mode, onClose, onOpenMap, contemporariesOn, onToggleContemporaries, prevItem, nextItem, onNav }) {
  const [shareMsg, setShareMsg] = useState('');
  // Esc סוגר את הכרטיס (נגישות מקלדת)
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);
  // איפוס הודעת השיתוף במעבר בין פריטים
  useEffect(() => { setShareMsg(''); }, [item]);

  const doShare = async () => {
    const res = await shareLink({
      url: itemPageUrl(item),
      title: `${item.name} — ציר הזמן של עם ישראל`,
    });
    if (res === 'copied') setShareMsg('הועתק ✓');
    else if (res === 'failed') setShareMsg('העתקה נכשלה');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2000);
  };

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
      {item.empire && <div className="detail-row"><b>מעצמה:</b> {item.empire}</div>}
      {item.judgment && (
        <div className={`judgment-chip ${item.judgment}`}>{JUDGMENT_LABELS[item.judgment]}</div>
      )}
      <p className="detail-desc">{item.description}</p>
      {/* שורת פעולות — אייקונים תחת התיאור */}
      <div className="card-actions">
        <button
          type="button"
          className={`card-action${contemporariesOn ? ' active' : ''}`}
          onClick={onToggleContemporaries}
          title="הדגשת כל מי שחי במקביל"
          aria-pressed={contemporariesOn}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
          </svg>
          <span>בני-הזמן</span>
        </button>

        {hasMap && (
          <button type="button" className="card-action" onClick={() => onOpenMap(item)} title="מפת המקומות במסע">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
            <span>מפה</span>
          </button>
        )}

        <button type="button" className="card-action" onClick={doShare} title={`שיתוף הדף של ${item.name}`}>
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
            <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
          </svg>
          <span>{shareMsg || 'שיתוף'}</span>
        </button>
      </div>

      {item.source && (
        <div className="detail-source">
          <b>מקור:</b>{' '}
          {sourceSegments(item.source).map((seg, i) => (
            <span key={i}>
              {i > 0 && '; '}
              {seg.href ? (
                <a className="source-link" href={seg.href} target="_blank" rel="noopener noreferrer">
                  {seg.text}
                </a>
              ) : seg.text}
            </span>
          ))}
        </div>
      )}
      {(prevItem || nextItem) && (
        <div className="detail-nav">
          {prevItem ? (
            <button className="nav-btn" onClick={() => onNav(prevItem)} title="הקודם (מוקדם יותר)">
              <span className="nav-arrow">►</span>
              <span className="nav-name">{prevItem.name}</span>
            </button>
          ) : <span className="nav-spacer" />}
          {nextItem ? (
            <button className="nav-btn" onClick={() => onNav(nextItem)} title="הבא (מאוחר יותר)">
              <span className="nav-name">{nextItem.name}</span>
              <span className="nav-arrow">◄</span>
            </button>
          ) : <span className="nav-spacer" />}
        </div>
      )}
      <Suspense fallback={<div className="comments-loading">טוען תגובות…</div>}>
        <Comments
          key={`${item.kind}:${item.id}`}
          targetKey={`${item.kind}:${item.id}`}
          targetLabel={item.name}
        />
      </Suspense>
    </aside>
  );
}
