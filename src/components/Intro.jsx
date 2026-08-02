import { useEffect, useState } from 'react';
import SpotlightTour from './SpotlightTour.jsx';

/* --- שני המבטים במסך הפתיחה. האיורים מונפשים (CSS) כדי שהבחירה תהיה
   ויזואלית: רואים מה כל מבט עושה במקום לקרוא עליו. --- */

// מבט הציר: חיי הדמויות כפסים אופקיים לאורך זמן. עמודת-הזמן נעה ומראה
// שבכל רגע נתון כמה דמויות חיות במקביל - בדיוק החוזק של התצוגה הזו.
const LIFELINES = [
  { y: 16, x: 18, w: 78 }, { y: 32, x: 60, w: 96 }, { y: 48, x: 34, w: 62 },
  { y: 64, x: 108, w: 84 }, { y: 80, x: 76, w: 118 }, { y: 96, x: 140, w: 66 },
];
function IlloViewTimeline() {
  return (
    <svg viewBox="0 0 240 130" className="illo vw-illo" role="img" aria-label="ציר הזמן האופקי">
      <rect className="vw-scan" x="96" y="6" width="30" height="112" rx="5" />
      {LIFELINES.map((l, i) => (
        <rect key={i} className="vw-life" x={l.x} y={l.y} width={l.w} height={9} rx="4.5"
          style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
      <line className="vw-axis" x1="10" y1="114" x2="230" y2="114" />
      {[30, 80, 130, 180, 220].map((x) => <line key={x} className="vw-tick" x1={x} y1="110" x2={x} y2="118" />)}
    </svg>
  );
}

// מבט המסע: מפה עם מסלול שנמתח תחנה אחר תחנה, וכרטיס הסיפור לצדה
function IlloViewAtlas() {
  return (
    <svg viewBox="0 0 240 130" className="illo vw-illo" role="img" aria-label="מסע על המפה">
      <rect className="vw-map" x="118" y="10" width="112" height="110" rx="8" />
      <path className="vw-coast" d="M132 12 L138 42 L130 70 L140 100 L134 120" fill="none" />
      <path className="vw-route" d="M150 100 L166 78 L158 56 L178 40 L198 26" fill="none" />
      {[[150, 100], [166, 78], [158, 56], [178, 40], [198, 26]].map(([cx, cy], i) => (
        <circle key={i} className="vw-pin" cx={cx} cy={cy} r="4.5" style={{ animationDelay: `${0.3 + i * 0.28}s` }} />
      ))}
      <rect className="vw-card" x="10" y="10" width="96" height="110" rx="8" />
      <rect className="vw-ln vw-ln-t" x="22" y="24" width="48" height="10" rx="5" />
      {[44, 58, 72, 86].map((y, i) => (
        <rect key={y} className="vw-ln" x="22" y={y} width={i % 2 ? 62 : 72} height="6" rx="3" />
      ))}
    </svg>
  );
}

// שכבות התצוגה. הצבע משמש את הצ׳יפים בשלב "מה להציג" בסיור.
export const LAYERS = [
  { key: 'leaders', icon: '🏛️', label: 'אבות ומנהיגים', color: 'var(--leader)' },
  { key: 'judges', icon: '⚖️', label: 'שופטים', color: 'var(--judge)' },
  { key: 'kings', icon: '👑', label: 'מלכים', color: 'var(--judah)' },
  { key: 'prophets', icon: '📜', label: 'נביאים', color: 'var(--prophet)' },
  { key: 'books', icon: '📖', label: 'ספרי תנ״ך', color: 'var(--book)' },
  { key: 'events', icon: '◆', label: 'אירועים', color: 'var(--event)' },
  { key: 'world', icon: '🌍', label: 'רקע עולמי', color: 'var(--world)' },
];

// שלבי הסיור: כל אחד מצביע על אזור אמיתי בממשק. before מכין את המסך -
// הכרטיס והמפה קיימים רק אחרי שנבחרה דמות, ולכן פותחים אחת לפני השלב שלהם.
const tourSteps = ({ onStartJourney }) => [
  { sel: '.search-box', title: 'חיפוש וקפיצה',
    text: 'הקלידו שם של דמות, אירוע או מקום - והציר יזנק ישר אליו.' },
  { sel: '.scroll-area, .vtl-wrap', title: 'הציר עצמו',
    text: 'הזמן זורם מימין (עבר) לשמאל. גללו לצדדים, וזמו בצביטה או ב-Ctrl+גלגלת.' },
  { sel: '.era-strip', title: 'קפיצה בין תקופות',
    text: 'פס התקופות. לחיצה מזיזה את הציר לתחילת התקופה שבחרתם.' },
  { sel: '.legend, .controls, .bottom-nav button:last-child', title: 'מה להציג?', picker: true,
    text: 'בחרו כאן ועכשיו אילו שכבות יופיעו על הציר. תמיד אפשר לשנות בהמשך.' },
  { sel: '.detail-card', title: 'הכרטיס', before: onStartJourney,
    text: 'הסיפור המלא, הפסוק, המקורות, בני-הזמן ותגובות - וכפתור לאותה דמות במסע הדורות.' },
  { sel: '.dc-hl', title: 'בני-הזמן',
    text: 'הכפתור "בני-הזמן" מדגיש על הציר את כל מי שחי באותה תקופה, ומעמעם את השאר.' },
  { sel: '.mode-btn', title: 'המבט השני',
    text: 'מסע הדורות מציג את אותם נתונים דמות אחר דמות, עם המפה והסיפור לצדה.' },
  { sel: '.note-btn', title: 'מצאתם טעות?',
    text: 'התאריכים והמקורות נאספו בקפידה, אבל תמיד יש מה לתקן. הכפתור הזה שולח הערה, תיקון או מקור ישירות אליי - ואני קורא הכל.' },
];


export default function Intro({ open, onClose, visible, setVisible, mode = 'tour', onStartJourney,
  atlasHref = '/atlas', onChooseView }) {
  // בביקור ראשון מציגים מסך-פתיחה במקום סיור של 7 שקפים; הסיור המלא נשאר
  // זמין דרך כפתור ה-? בכותרת.
  const [phase, setPhase] = useState(mode);
  // מסך הפתיחה בנוי משתי שאלות נפרדות, כי ערבוב שלהן נתן ארבע אפשרויות
  // במסך אחד: קודם באיזו תצוגה להתחיל, ורק אחר כך אם רוצים הדרכה.
  const [chosen, setChosen] = useState(null);

  useEffect(() => { if (open) { setPhase(mode); setChosen(null); } }, [open, mode]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ===== מסך פתיחה, שאלה ראשונה: באיזו תצוגה להתחיל =====
  // המסך אטום ומחולק לשניים - הציר שמאחור הסיח והכביד על ההחלטה.
  if (phase === 'welcome' && !chosen) {
    return (
      <div className="wsplit">
        <button className="about-close wsplit-x" onClick={onClose} aria-label="דילוג וסגירה">✕</button>
        <div className="wsplit-head">
          <div className="intro-hero" aria-hidden="true">📖</div>
          <h2 className="intro-welcome-title">ציר הזמן של עם ישראל</h2>
          <p className="intro-value">
            כל ההיסטוריה המקראית - מהאבות ועד חורבן בית שני.
            אותם נתונים, שני מבטים. במה נתחיל?
          </p>
        </div>
        <div className="wsplit-body">
          <button className="wpane" onClick={() => setChosen('timeline')}>
            <IlloViewTimeline />
            <div className="vw-txt">
              <b>📜 ציר הזמן</b>
              <span>מי חי מתי, ומי לצד מי - כל הדורות בתמונה אחת</span>
            </div>
          </button>
          <button className="wpane" onClick={() => setChosen('atlas')}>
            <IlloViewAtlas />
            <div className="vw-txt">
              {/* במסך צר המסע מוצג ראשון ומסומן כמומלץ - הציר האופקי דורש
                  רוחב, והמסע נבנה כרשימה נגללת שמתאימה לטלפון */}
              <span className="wrec">מומלץ בטלפון</span>
              <b>🗺️ מסע הדורות</b>
              <span>דמות אחר דמות, עם המפה והסיפור המלא לצדה</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ===== שאלה שנייה: הדרכה או ישר פנימה =====
  if (phase === 'welcome') {
    const atlas = chosen === 'atlas';
    // מעבר לתצוגה שנבחרה. בציר נשארים באותו דף; במסע עוברים לכתובת, ולכן
    // בקשת ההדרכה נשלחת אליו בכתובת (?tour=1).
    const go = (tour) => {
      onChooseView?.(chosen);
      if (atlas) { window.location.href = atlasHref + (atlasHref.includes('?') ? '&' : '?') + (tour ? 'tour=1' : ''); return; }
      if (tour) { setPhase('tour'); return; }
      onClose(); onStartJourney?.();
    };
    return (
      <div className="wsplit wsplit-ask">
        <button className="about-close wsplit-x" onClick={onClose} aria-label="דילוג וסגירה">✕</button>
        <div className="intro-card intro-welcome-card" onClick={(e) => e.stopPropagation()}>
          <div className="intro-hero" aria-hidden="true">{atlas ? '🗺️' : '📜'}</div>
          <h2 className="intro-welcome-title">{atlas ? 'מסע הדורות' : 'ציר הזמן'}</h2>
          <p className="intro-value">רוצים סיור קצר שמראה מה אפשר לעשות כאן?</p>
          <div className="wask">
            <button className="intro-btn primary" onClick={() => go(true)}>✨ כן, סיור קצר</button>
            <button className="intro-btn" onClick={() => go(false)}>לא, בואו נתחיל</button>
          </div>
          <div className="intro-welcome-links">
            <button className="intro-link" onClick={() => setChosen(null)}>בחירת תצוגה אחרת →</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== סיור =====
  // עד כה היו כאן שבעה שקפים שהסבירו על ממשק שלא נראה מאחוריהם. כעת זה
  // סיור על המסך עצמו: זרקור על אזור אמיתי, שלב אחר שלב.
  return (
    <SpotlightTour
      steps={tourSteps({ onStartJourney })}
      onDone={onClose}
      layers={LAYERS}
      visible={visible || {}}
      setVisible={(v) => setVisible(v)}
    />
  );
}
