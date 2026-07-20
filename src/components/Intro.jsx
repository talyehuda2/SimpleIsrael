import { useEffect, useRef, useState } from 'react';

/* איורים מונפשים (SVG) — אחד לכל נושא. הצבעים מגיעים ממשתני ה-CSS של העיצוב. */

function IlloSearch() {
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="חיפוש וקפיצה">
      <rect x="30" y="18" width="180" height="30" rx="15" className="il-box" />
      <circle cx="47" cy="33" r="6" className="il-stroke" fill="none" />
      <line x1="51" y1="37" x2="57" y2="43" className="il-stroke" />
      <rect x="64" y="27" width="70" height="12" rx="4" className="il-typed" />
      <rect x="40" y="66" width="160" height="16" rx="5" className="il-row" />
      <rect x="40" y="90" width="160" height="16" rx="5" className="il-row il-hit" />
    </svg>
  );
}

// "חומת אבנים" — פסים אופקיים בשורות מדורגות, בגדלים וברווחים לא-סימטריים.
// r: 'a' עוגן שנבחר · 'c' בן-זמן (חופף בעמודת-הזמן) · 'o' אחר (מתעמעם).
const STONES = [
  { x: 26, y: 15, w: 52, h: 14, r: 'o' }, { x: 92, y: 15, w: 40, h: 14, r: 'c' }, { x: 150, y: 15, w: 64, h: 14, r: 'o' },
  { x: 40, y: 34, w: 34, h: 18, r: 'o' }, { x: 84, y: 34, w: 58, h: 18, r: 'c' }, { x: 172, y: 34, w: 42, h: 18, r: 'o' },
  { x: 30, y: 57, w: 40, h: 16, r: 'o' }, { x: 94, y: 57, w: 44, h: 16, r: 'a' }, { x: 162, y: 57, w: 52, h: 16, r: 'o' },
  { x: 48, y: 78, w: 30, h: 13, r: 'o' }, { x: 100, y: 78, w: 36, h: 13, r: 'c' }, { x: 156, y: 78, w: 58, h: 13, r: 'o' },
  { x: 26, y: 96, w: 60, h: 17, r: 'o' }, { x: 104, y: 96, w: 46, h: 17, r: 'c' }, { x: 170, y: 96, w: 44, h: 17, r: 'o' },
];
const ROLE_CLS = { a: 'il-st-anchor', c: 'il-st-ctemp', o: 'il-st-other' };

function IlloContemp() {
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="בני-הזמן">
      <rect x="88" y="8" width="54" height="116" rx="6" className="il-band2" />
      {STONES.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="3"
          className={`il-stone ${ROLE_CLS[s.r]}`} />
      ))}
    </svg>
  );
}

function IlloTree() {
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="אילן יוחסין">
      <path d="M120 42 V64 H70 V78" className="il-tline" fill="none" />
      <path d="M120 42 V64 H170 V78" className="il-tline il-tline2" fill="none" />
      <rect x="98" y="22" width="44" height="22" rx="6" className="il-tnode il-troot" />
      <rect x="48" y="78" width="44" height="22" rx="6" className="il-tnode il-tn1" />
      <rect x="148" y="78" width="44" height="22" rx="6" className="il-tnode il-tn2" />
    </svg>
  );
}

function IlloMap() {
  const d = 'M30 100 Q70 30 120 70 T210 40';
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="מפת המסע">
      <path d={d} className="il-mpath" fill="none" />
      <path d={d} className="il-mprogress" fill="none" />
      <circle r="7" className="il-mdot">
        <animateMotion dur="2.6s" repeatCount="indefinite" path={d} keyPoints="0;1;1" keyTimes="0;0.75;1" calcMode="linear" />
      </circle>
    </svg>
  );
}

function IlloComments() {
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="תגובות">
      <rect x="40" y="24" width="160" height="82" rx="10" className="il-box" />
      <rect x="54" y="40" width="80" height="10" rx="4" className="il-row" />
      <g className="il-bubble">
        <rect x="70" y="60" width="120" height="34" rx="10" className="il-bub" />
        <circle cx="92" cy="77" r="3.2" className="il-dot il-dot1" />
        <circle cx="104" cy="77" r="3.2" className="il-dot il-dot2" />
        <circle cx="116" cy="77" r="3.2" className="il-dot il-dot3" />
      </g>
    </svg>
  );
}

function IlloNav() {
  return (
    <svg viewBox="0 0 240 130" className="illo" role="img" aria-label="ניווט">
      <g className="il-pan">
        {[20, 60, 100, 140, 180, 220, 260].map((x) => (
          <g key={x}>
            <line x1={x} y1="26" x2={x} y2="104" className="il-tick" />
            <rect x={x - 14} y="54" width="28" height="14" rx="4" className="il-nbar" />
          </g>
        ))}
      </g>
      <g className="il-lens">
        <circle cx="120" cy="65" r="20" className="il-stroke" fill="none" />
        <line x1="135" y1="80" x2="146" y2="91" className="il-stroke" />
      </g>
    </svg>
  );
}

const SLIDES = [
  { key: 'search', title: 'חיפוש וקפיצה', text: 'הקלידו שם של דמות או אירוע בתיבת החיפוש — והציר יזנק ישר אליו.', Illo: IlloSearch },
  { key: 'contemp', title: 'בני-הזמן', text: 'בכל כרטיס יש כפתור שמדגיש את כל מי שחי באותה תקופה — ומעמעם את השאר.', Illo: IlloContemp },
  { key: 'tree', title: 'אילן יוחסין', text: 'השושלת מאברהם ואילך. לחיצה על שם באילן קופצת אליו בציר הזמן.', Illo: IlloTree },
  { key: 'map', title: 'מפת המסע', text: 'לדמויות נבחרות — מסע מודרך על מפת הארץ, תחנה אחר תחנה.', Illo: IlloMap },
  { key: 'comments', title: 'תגובות הקהילה', text: 'אפשר להוסיף הערה, מקור או תיקון לכל אירוע ודמות — וכולם רואים.', Illo: IlloComments },
  { key: 'nav', title: 'ניווט בציר', text: 'הזמן זורם מימין (עבר) לשמאל · זום בצביטה או ב-Ctrl+גלגלת · לחיצה על שם שכבה מקטינה אותה.', Illo: IlloNav },
];

export default function Intro({ open, onClose }) {
  const [step, setStep] = useState(0);
  const touchX = useRef(null);

  useEffect(() => { if (open) setStep(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setStep((s) => Math.min(SLIDES.length - 1, s + 1));
      else if (e.key === 'ArrowRight') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const last = step === SLIDES.length - 1;
  const s = SLIDES[step];
  const next = () => (last ? onClose() : setStep((v) => v + 1));
  const prev = () => setStep((v) => Math.max(0, v - 1));

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -45) next();            // החלקה שמאלה — הבא
    else if (dx > 45) prev();        // החלקה ימינה — הקודם
  };

  return (
    <div className="intro-overlay" onClick={onClose}>
      <div
        className="intro-card"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button className="about-close" onClick={onClose} aria-label="דילוג וסגירה">✕</button>

        {step === 0 && <div className="intro-welcome">ברוכים הבאים 📖</div>}

        {/* התוכן ממופתח לפי step כדי שהאנימציה תתחיל מחדש בכל מעבר */}
        <div className="intro-stage" key={s.key}>
          <div className="intro-illo-wrap">{<s.Illo />}</div>
          <h3 className="intro-slide-title">{s.title}</h3>
          <p className="intro-slide-text">{s.text}</p>
        </div>

        <div className="intro-dots" role="tablist" aria-label="התקדמות">
          {SLIDES.map((sl, i) => (
            <button
              key={sl.key}
              className={`intro-dot${i === step ? ' on' : ''}`}
              aria-label={`מסך ${i + 1}`}
              aria-selected={i === step}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        <div className="intro-nav">
          <button className="intro-btn ghost" onClick={prev} disabled={step === 0}>הקודם</button>
          <span className="intro-count">{step + 1} / {SLIDES.length}</span>
          <button className="intro-btn primary" onClick={next}>
            {last ? 'יאללה, מתחילים' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}
