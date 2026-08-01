import { lazy, Suspense, useEffect, useState } from 'react';
import { formatRange } from '../utils/dates.js';
import { shareLink, itemPageUrl } from '../lib/share.js';
import { sourceSegments } from '../utils/sefaria.js';
import maps from '../data/maps.json';

// נטען רק כשנפתחות התגובות - כך ספריית Supabase לא מכבידה על טעינת הציר
const Comments = lazy(() => import('./Comments.jsx'));

const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך - הממלכה המאוחדת',
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
  collections = [], onOpenCollection,
}) {
  const [shareMsg, setShareMsg] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  // טיפ חד-פעמי בכרטיס הראשון: מה עושים עם "חי במקביל"
  const [coachContemp, setCoachContemp] = useState(() => {
    try { return !localStorage.getItem('si_coach_contemp'); } catch { return false; }
  });
  const dismissCoachContemp = () => {
    setCoachContemp(false);
    try { localStorage.setItem('si_coach_contemp', '1'); } catch { /* מתעלמים */ }
  };

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  // איפוס מצב הכרטיס במעבר בין פריטים
  useEffect(() => { setShareMsg(''); setExpanded(false); setShowComments(false); }, [item]);

  const doShare = async () => {
    const res = await shareLink({ url: itemPageUrl(item), title: `${item.name} - ציר הזמן של עם ישראל` });
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
      <button className="card-share" onClick={doShare} title={`שיתוף הדף של ${item.name}`} aria-label={`שיתוף הדף של ${item.name}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
        </svg>
        {shareMsg && <span className="card-share-msg">{shareMsg}</span>}
      </button>

      {/* גיבור: תגית+שיפוט בשורה, שם עם חיצי ניווט, תאריכים עם "משוער" מוטמע */}
      <div className="dc-chiprow">
        <div className={`kind-chip ${item.kind}`}>{KIND_LABELS[item.kind]}</div>
        {item.judgment && (
          <span className={`dc-judgment ${item.judgment}`}>{JUDGMENT_LABELS[item.judgment]}</span>
        )}
        {/* שיוך לאוספים - פתח להרחבה מהקשר של הדמות */}
        {collections.map((c) => (
          <button
            key={c.id}
            className="dc-coll-chip"
            onClick={() => onOpenCollection?.(c)}
            title={`${c.title} - ${c.subtitle}`}
          >{c.icon} {c.title}</button>
        ))}
      </div>
      <div className="dc-titlerow">
        <h2>{item.name}</h2>
        <span className="dc-navpair">
          {prevItem && (
            <button className="dc-navbtn" onClick={() => onNav(prevItem)} title={`מוקדם יותר: ${prevItem.name}`} aria-label={`מוקדם יותר: ${prevItem.name}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          {nextItem && (
            <button className="dc-navbtn" onClick={() => onNav(nextItem)} title={`מאוחר יותר: ${nextItem.name}`} aria-label={`מאוחר יותר: ${nextItem.name}`}>
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </span>
      </div>
      <div className="detail-years">
        {formatRange(item.start, item.end, mode)}
        {item.approxDates && (
          <span className="detail-approx-inline" title="התורה אינה מפרטת את שנות חייה; התאריכים משוערים לפי בעלהּ ולפי אירועים מתוארכים בסמוך"> · ≈ משוער</span>
        )}
      </div>

      {/* מיני-ציר - הקשר כרונולוגי במבט אחד */}
      <div className="dc-era" title="מיקום על ציר הזמן כולו">
        <div className="dc-era-track">
          <span className="dc-era-span" style={{ insetInlineStart: `${offPct}%`, width: `${wPct}%` }} />
          {/* סמן עגול תמיד-נראה במרכז הטווח (הזמן זורם ימין→שמאל) */}
          <span className="dc-era-dot" style={{ insetInlineStart: `calc(${offPct + wPct / 2}% - 7px)` }} />
        </div>
        {/* המכולה RTL: הילד הראשון נדחף ימינה - והימין הוא העבר */}
        <div className="dc-era-labels"><span>האבות</span><span>חורבן בית שני</span></div>
      </div>

      {/* שורת מטא שקטה - טקסט מופרד בנקודות במקום ענן תגיות */}
      {tags.length > 0 && (
        <div className="dc-meta">
          {tags.map((t, i) => (
            <span key={i} className="dc-meta-item">
              {i > 0 && <span className="dc-meta-sep" aria-hidden="true"> · </span>}
              <span aria-hidden="true">{t.icon}</span> {t.text}
            </span>
          ))}
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

      {/* הפסוק המגדיר - ציטוט מוגבה שנותן את הנקודה בלשון המקרא עצמו */}
      {item.verse && (
        <blockquote className="dc-verse">
          <span className="dc-verse-text">{item.verse}</span>
          {item.verseRef && <cite className="dc-verse-ref">{item.verseRef}</cite>}
        </blockquote>
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
          {coachContemp && (
            <div className="coach-tip">
              💡 לחצו על שם כדי לקפוץ אליו, או על "הדגש בציר" כדי לראות את כל בני הדור
              <button className="coach-x" onClick={dismissCoachContemp} aria-label="הבנתי">✕</button>
            </div>
          )}
          <div className="dc-chips scroll">
            {contemporaries.slice(0, 20).map((c) => (
              <button key={`${c.kind}:${c.id}`} className="dc-chip" onClick={() => onNav(c)} title={`${c.name} · ${c.start}–${c.end}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* "אולי יעניין אותך" - מדור אחד, שורה נגללת אחת; 📍 מסמן קשר-מקום */}
      {(relatedPlace.length > 0 || relatedEra.length > 0) && (
        <div className="dc-related">
          <div className="dc-row-label">אולי יעניין אותך גם</div>
          <div className="dc-chips scroll">
            {relatedPlace.map((r) => (
              <button key={`p-${r.kind}:${r.id}`} className="dc-chip" onClick={() => onNav(r)} title={`${r.name} · ${r.place}`}>
                📍 {r.name}<span className="dc-chip-sub"> · {r.place}</span>
              </button>
            ))}
            {relatedEra
              .filter((r) => !relatedPlace.some((p) => p.kind === r.kind && p.id === r.id))
              .map((r) => (
                <button key={`e-${r.kind}:${r.id}`} className="dc-chip" onClick={() => onNav(r)}>{r.name}</button>
              ))}
          </div>
        </div>
      )}

      <div className="card-actions">
        {onOpenMap && (
          <button type="button" className="card-action" onClick={onOpenMap} title={`מפת המסע של ${item.name}`}>
            <span className="dc-cbig" aria-hidden="true">🗺️</span>
            <span>מפת מסע</span>
          </button>
        )}
        {/* גשר למבט השני - אותה דמות, הפעם עם המפה והסיפור המלא לצדה */}
        <a
          className="card-action"
          href={`/atlas?sel=${item.kind}:${item.id}`}
          title={`${item.name} במסע הדורות - המפה והסיפור המלא`}
        >
          <span className="dc-cbig" aria-hidden="true">🧭</span>
          <span>מסע הדורות</span>
        </a>
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
