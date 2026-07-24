import { lazy, Suspense, useEffect, useState } from 'react';
import { formatRange } from '../utils/dates.js';
import { shareLink, itemPageUrl } from '../lib/share.js';
import { sourceSegments } from '../utils/sefaria.js';
import maps from '../data/maps.json';

// נטען רק כשנפתחות התגובות — כך ספריית Supabase לא מכבידה על טעינת הציר
const Comments = lazy(() => import('./Comments.jsx'));

const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך — הממלכה המאוחדת',
  judah: 'מלך יהודה', israel: 'מלך ישראל', prophet: 'נביא',
  book: 'ספר', event: 'אירוע', world: 'רקע עולמי', empire: 'מלכות עולמית',
};
const JUDGMENT_LABELS = {
  good: 'עשה הישר בעיני ה\'',
  bad: 'עשה הרע בעיני ה\'',
  mixed: 'מעורב',
};
const DESC_LIMIT = 165;

export default function DetailCard({
  item, mode, onClose, onOpenMap, contemporariesOn, onToggleContemporaries,
  prevItem, nextItem, onNav, axisStart, axisEnd, contemporaries = [],
  relatedEra = [], relatedPlace = [], commentCount = 0,
}) {
  const [shareMsg, setShareMsg] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  // איפוס מצב הכרטיס במעבר בין פריטים
  useEffect(() => { setShareMsg(''); setExpanded(false); setShowComments(false); }, [item]);

  const doShare = async () => {
    const res = await shareLink({ url: itemPageUrl(item), title: `${item.name} — ציר הזמן של עם ישראל` });
    if (res === 'copied') setShareMsg('הועתק ✓');
    else if (res === 'failed') setShareMsg('נכשל');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2000);
  };

  if (!item) return null;
  const hasMap = !!maps[item.id];
  const desc = item.description || '';
  const isLong = desc.length > DESC_LIMIT;
  const shown = !isLong || expanded ? desc : desc.slice(0, DESC_LIMIT).trim() + '…';

  // מיני-ציר: איפה הפריט יושב על כל ההיסטוריה (הזמן זורם מימין לשמאל)
  const span = Math.max(1, axisEnd - axisStart);
  const offPct = Math.max(0, Math.min(100, ((item.start - axisStart) / span) * 100));
  const wPct = Math.max(1.5, Math.min(100 - offPct, ((item.end - item.start) / span) * 100));

  const tags = [];
  if (item.reignText) tags.push({ icon: '👑', text: item.reignText });
  if (item.lifeText) tags.push({ icon: '⏳', text: item.lifeText });
  if (item.tenureText) tags.push({ icon: '⚖️', text: item.tenureText });
  if (item.kings) tags.push({ icon: '🤝', text: `בימי ${item.kings}` });
  if (item.empire) tags.push({ icon: '🌍', text: item.empire });

  return (
    <aside className="detail-card">
      <button className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>

      <div className={`kind-chip ${item.kind}`}>{KIND_LABELS[item.kind]}</div>
      <h2>{item.name}</h2>
      <div className="detail-years">{formatRange(item.start, item.end, mode)}</div>

      {/* מיני-ציר — הקשר כרונולוגי במבט אחד */}
      <div className="dc-era" title="מיקום על ציר הזמן כולו">
        <div className="dc-era-track">
          <span className="dc-era-span" style={{ insetInlineStart: `${offPct}%`, width: `${wPct}%` }} />
          {/* סמן עגול תמיד-נראה במרכז הטווח (הזמן זורם ימין→שמאל) */}
          <span className="dc-era-dot" style={{ insetInlineStart: `calc(${offPct + wPct / 2}% - 7px)` }} />
        </div>
        {/* המכולה RTL: הילד הראשון נדחף ימינה — והימין הוא העבר */}
        <div className="dc-era-labels"><span>האבות</span><span>חורבן בית שני</span></div>
      </div>

      {tags.length > 0 && (
        <div className="dc-tags">
          {tags.map((t, i) => (
            <span key={i} className="dc-tag"><span aria-hidden="true">{t.icon}</span>{t.text}</span>
          ))}
          {item.judgment && (
            <span className={`dc-tag judgment ${item.judgment}`}>{JUDGMENT_LABELS[item.judgment]}</span>
          )}
        </div>
      )}

      {desc && (
        <p className="detail-desc">
          {shown}
          {isLong && (
            <button className="dc-more" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'פחות' : 'עוד'}
            </button>
          )}
        </p>
      )}

      {contemporaries.length > 0 && (
        <div className="dc-contemp">
          <div className="dc-contemp-head">
            <span>חי במקביל</span>
            <button
              className={`dc-hl${contemporariesOn ? ' on' : ''}`}
              onClick={onToggleContemporaries}
              aria-pressed={contemporariesOn}
              title="הדגשת כל בני-הזמן על הציר"
            >
              {contemporariesOn ? 'בטל הדגשה' : 'הדגש בציר'}
            </button>
          </div>
          <div className="dc-chips">
            {contemporaries.slice(0, 8).map((c) => (
              <button key={`${c.kind}:${c.id}`} className="dc-chip" onClick={() => onNav(c)} title={`${c.name} · ${c.start}–${c.end}`}>
                {c.name}
              </button>
            ))}
            {contemporaries.length > 8 && <span className="dc-chip more">+{contemporaries.length - 8}</span>}
          </div>
        </div>
      )}

      <div className="card-actions">
        <button type="button" className="card-action" onClick={doShare} title={`שיתוף הדף של ${item.name}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
          </svg>
          <span>{shareMsg || 'שיתוף'}</span>
        </button>
        <button
          type="button"
          className={`card-action${showComments ? ' active' : ''}`}
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
        >
          <span className="dc-cbig" aria-hidden="true">💬</span>
          <span>{commentCount > 0 ? `תגובות · ${commentCount}` : 'תגובות'}</span>
        </button>
      </div>

      {item.source && (
        <div className="detail-source">
          <b>מקור:</b>{' '}
          {sourceSegments(item.source).map((seg, i) => (
            <span key={i}>
              {i > 0 && '; '}
              {seg.href
                ? <a className="source-link" href={seg.href} target="_blank" rel="noopener noreferrer">{seg.text}</a>
                : seg.text}
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

      {(relatedPlace.length > 0 || relatedEra.length > 0) && (
        <div className="dc-related">
          <h3 className="dc-related-title">אולי יעניין אותך גם</h3>
          {relatedPlace.length > 0 && (
            <div className="dc-relgroup">
              <span className="dc-rellabel">אותו מקום</span>
              <div className="dc-chips">
                {relatedPlace.map((r) => (
                  <button key={`${r.kind}:${r.id}`} className="dc-chip" onClick={() => onNav(r)} title={`${r.name} · ${r.place}`}>
                    {r.name}<span className="dc-chip-sub"> · {r.place}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {relatedEra.length > 0 && (
            <div className="dc-relgroup">
              <span className="dc-rellabel">מאותה תקופה</span>
              <div className="dc-chips">
                {relatedEra.map((r) => (
                  <button key={`${r.kind}:${r.id}`} className="dc-chip" onClick={() => onNav(r)}>{r.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showComments && (
        <Suspense fallback={<div className="comments-loading">טוען תגובות…</div>}>
          <Comments
            key={`${item.kind}:${item.id}`}
            targetKey={`${item.kind}:${item.id}`}
            targetLabel={item.name}
          />
        </Suspense>
      )}
    </aside>
  );
}
