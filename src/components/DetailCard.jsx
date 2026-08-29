import { lazy, Suspense, useEffect, useState } from 'react';
import { formatRange, formatRangeAM, formatRangeSecular } from '../utils/dates.js';
import { shareLink, itemPageUrl } from '../lib/share.js';
import { sourceSegments } from '../utils/sefaria.js';
import { periodOf } from '../data/items.js';
import maps from '../data/maps.json';
import ChunkBoundary from './ChunkBoundary.jsx';
import './ChronoNote.css';

// נטען רק כשנפתחות התגובות - כך ספריית Supabase לא מכבידה על טעינת הציר
const Comments = lazy(() => import('./Comments.jsx'));

const KIND_LABELS = {
  leader: 'מנהיג', judge: 'שופט', united: 'מלך - הממלכה המאוחדת',
  judah: 'מלך יהודה', israel: 'מלך ישראל', prophet: 'נביא',
  book: 'ספר', event: 'אירוע', world: 'רקע עולמי', empire: 'מלכות עולמית',
};
/* כותרת רשימת בני-הזמן. "חי במקביל" מתאים לדמות, אבל לא לאירוע
   (התרחש) ולא לספר (מתאר תקופה) - ולכן הניסוח משתנה לפי סוג הפריט. */
const CONTEMP_HEADS = { event: 'התרחש במקביל', book: 'בני התקופה', empire: 'בני התקופה' };
const contempHead = (kind) => CONTEMP_HEADS[kind] || 'חי במקביל';

const JUDGMENT_LABELS = {
  good: 'עשה הישר בעיני ה\'',
  bad: 'עשה הרע בעיני ה\'',
  mixed: 'מעורב',
};

/* כרטיס הפריט - רכיב אחד לשני המסכים.
   variant='timeline': כפתור סגירה, כפתור מפה, והחיצים מנווטים בציר.
   variant='atlas':    אין סגירה בדסקטופ (הפאנל קבוע), ואין כפתור מפה
                       כי המפה ממילא פרושׂה לצדו. */
export default function DetailCard({
  item, mode = 'tradition', variant = 'timeline',
  onClose, onOpenMap, contemporariesOn, onToggleContemporaries,
  prevItem, nextItem, onNav, axisStart, axisEnd, contemporaries = [],
  commentCount = 0, collections = [], onOpenCollection,
  switchHref, switchLabel, openComments = false,
}) {
  const [shareMsg, setShareMsg] = useState('');
  /* הסבר הכרונולוגיה - סגור כברירת מחדל. לא title, כי רמז שמופיע
     בריחוף אינו קיים במגע, ורוב הגולשים בטלפון. */
  const [chronoOpen, setChronoOpen] = useState(false);
  const [showComments, setShowComments] = useState(openComments);

  useEffect(() => {
    if (!item || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  useEffect(() => {
    setShareMsg(''); setShowComments(openComments); setChronoOpen(false);
  }, [item, openComments]);

  const doShare = async () => {
    const res = await shareLink({ url: itemPageUrl(item), title: `${item.name} - ציר הזמן של עם ישראל` });
    if (res === 'copied') setShareMsg('הועתק ✓');
    else if (res === 'failed') setShareMsg('נכשל');
    if (res === 'copied' || res === 'failed') setTimeout(() => setShareMsg(''), 2000);
  };

  if (!item) return null;
  const period = periodOf(item);

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
    <aside className={`detail-card dc-${variant}`}>
      {/* 1. ניווט לפריט הקודם/הבא, עם השמות */}
      {(prevItem || nextItem) && (
        <nav className="dc-steps" aria-label="ניווט בין פריטים">
          <button
            className="dc-step" disabled={!prevItem}
            onClick={() => prevItem && onNav(prevItem)}
            title={prevItem ? `מוקדם יותר: ${prevItem.name}` : 'אין מוקדם יותר'}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{prevItem ? prevItem.name : '—'}</span>
          </button>
          <button
            className="dc-step" disabled={!nextItem}
            onClick={() => nextItem && onNav(nextItem)}
            title={nextItem ? `מאוחר יותר: ${nextItem.name}` : 'אין מאוחר יותר'}
          >
            <span>{nextItem ? nextItem.name : '—'}</span>
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </nav>
      )}

      {/* 2. סוג, שיפוט ותגיות האוספים */}
      <div className="dc-chiprow">
        <div className={`kind-chip ${item.kind}`}>{KIND_LABELS[item.kind]}</div>
        {item.judgment && (
          <span className={`dc-judgment ${item.judgment}`}>{JUDGMENT_LABELS[item.judgment]}</span>
        )}
        {collections.map((c) => (
          <button
            key={c.id} className="dc-coll-chip"
            onClick={() => onOpenCollection?.(c)}
            title={`${c.title} - ${c.subtitle}`}
          >{c.icon} {c.title}</button>
        ))}
      </div>

      {/* 3. שיתוף, וסגירה רק היכן שיש מה לסגור */}
      <button className="card-share" onClick={doShare} title={`שיתוף הדף של ${item.name}`} aria-label={`שיתוף הדף של ${item.name}`}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81A3 3 0 1 0 6 15c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z" />
        </svg>
        {shareMsg && <span className="card-share-msg">{shareMsg}</span>}
      </button>
      {onClose && <button className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>}

      {/* 4. שם */}
      <h2 className="dc-name">{item.name}</h2>

      {/* 5. תאריכים - מבריאת העולם, ומתחת לפי הספירה */}
      <div className="detail-years">
        {mode === 'academic' ? formatRange(item.start, item.end, mode) : formatRangeAM(item.start, item.end)}
        {item.approxDates && (
          <span className="detail-approx-inline" title="התורה אינה מפרטת את שנות חייה; התאריכים משוערים לפי בעלהּ ולפי אירועים מתוארכים בסמוך"> · ≈ משוער</span>
        )}
      </div>
      {mode !== 'academic' && (
        <>
          <div className="detail-years-sec">
            {formatRangeSecular(item.start, item.end)}
            <button
              type="button" className="chrono-q" aria-expanded={chronoOpen}
              aria-label="למה השנים שונות ממה שמוכר לי?"
              onClick={() => setChronoOpen((v) => !v)}
            >?</button>
          </div>
          {chronoOpen && (
            <p className="chrono-note">
              השנים באתר נמנות לפי <strong>סדר עולם</strong>, הכרונולוגיה של חז״ל.
              המניין המחקרי המקובל מוקדם בכ-163 שנה, והפער כולו מרוכז בתקופה
              הפרסית: סדר עולם מונה בה 58 שנה, והמחקר כ-206.
            </p>
          )}
        </>
      )}

      {/* 6. מיני-ציר - הקשר כרונולוגי במבט אחד */}
      <div className="dc-era" title="מיקום על ציר הזמן כולו">
        <div className="dc-era-track">
          <span className="dc-era-span" style={{ insetInlineStart: `${offPct}%`, width: `${wPct}%` }} />
          <span className="dc-era-dot" style={{ insetInlineStart: `calc(${offPct + wPct / 2}% - 7px)` }} />
        </div>
        <div className="dc-era-labels"><span>האבות</span><span>חורבן בית שני</span></div>
      </div>

      {/* המפה היא הדבר הייחודי בכרטיס, והיא הייתה קבורה בשורת הכפתורים
          שבתחתיתו - מעבר לגלילה. כאן היא כפתור ראשי מיד מתחת לכותרת. */}
      {onOpenMap && maps[item.id] && (
        <button type="button" className="dc-map-cta" onClick={onOpenMap}>
          <span aria-hidden="true">🗺️</span>
          פתיחת מפת המסע
          <span className="dc-map-cta-sub">{maps[item.id].points.length} תחנות</span>
        </button>
      )}

      {/* 7. התקופה */}
      {period && (
        <div className="dc-period">
          <span aria-hidden="true">✦</span>
          <a href={`/p/period/${period.id}`}>{period.name}</a>
          <span className="dc-period-yrs">{period.start}–{period.end}</span>
        </div>
      )}

      {/* שורת מטא שקטה */}
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

      {/* 8. הפירוט המלא - בלי קיצור; הכרטיס נגלל ממילא */}
      {item.description && <p className="detail-desc">{item.description}</p>}

      {/* 9. הפסוק המגדיר */}
      {item.verse && (
        <blockquote className="dc-verse">
          <span className="dc-verse-text">{item.verse}</span>
          {item.verseRef && <cite className="dc-verse-ref">{item.verseRef}</cite>}
        </blockquote>
      )}

      {/* 10. מקור, מקושר לספריא */}
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

      {/* 11. בני-הזמן */}
      {contemporaries.length > 0 && (
        <div className="dc-contemp">
          <div className="dc-contemp-head">
            <span>{contempHead(item.kind)}</span>
            {onToggleContemporaries && (
              <button
                className={`dc-hl${contemporariesOn ? ' on' : ''}`}
                onClick={onToggleContemporaries}
                aria-pressed={contemporariesOn}
                title={contemporariesOn ? 'ביטול הדגשת בני-הזמן על הציר' : 'הדגשת כל בני-הזמן על הציר'}
              >
                👥 בני-הזמן
              </button>
            )}
          </div>
          <div className="dc-chips scroll">
            {contemporaries.slice(0, 20).map((c) => (
              <button key={`${c.kind}:${c.id}`} className="dc-chip" onClick={() => onNav(c)} title={`${c.name} · ${c.start}–${c.end}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 12-14. פעולות: מעבר למבט השני, מפה (בציר בלבד), דף מלא, תגובות */}
      <div className="card-actions">
        {switchHref && (
          <a className="card-action" href={switchHref} title={`${item.name} ב${switchLabel}`}>
            <span className="dc-cbig" aria-hidden="true">{variant === 'timeline' ? '🗺️' : '📜'}</span>
            <span>{switchLabel}</span>
          </a>
        )}
        {/* המפה עלתה לכפתור ראשי בראש הכרטיס, ולכן אינה חוזרת כאן */}
        <a className="card-action" href={`/p/${item.kind}/${item.id}`} title={`דף המידע המלא של ${item.name}`}>
          <span className="dc-cbig" aria-hidden="true">📖</span>
          <span>דף מלא</span>
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

      {showComments && (
        <ChunkBoundary>
          <Suspense fallback={<div className="comments-loading">טוען תגובות…</div>}>
            <Comments
              key={`${item.kind}:${item.id}`}
              targetKey={`${item.kind}:${item.id}`}
              targetLabel={item.name}
            />
          </Suspense>
        </ChunkBoundary>
      )}
    </aside>
  );
}
