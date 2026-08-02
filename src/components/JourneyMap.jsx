import { useState, useEffect, useRef } from 'react';
import maps from '../data/maps.json';
import { MAP_SRC, MAP_SIZE, journeyStations } from '../utils/mapProject.js';

/* מפת המסע - רכיב אחד לשני המסכים.
   variant='timeline': חלונית לצד הכרטיס (או שכבה מלאה במובייל).
   variant='atlas':    עמודה קבועה שממלאת את גובה המסך.

   המצלמה היא viewBox של SVG: במבט-על מציגים את כל המפה, ובמסע מתקרבים
   לתחנה בחלון שנחסם לגבולות התמונה - כך אף פעם לא נחשף שטח ריק.
   preserveAspectRatio="slice" משלים את זה: התמונה מכסה את החלון ונחתכת,
   במקום להשאיר פסים ריקים ביחסי מסך שונים. */

const KIND_COLOR = {
  leader: '#9c2b50', judge: '#bd7038', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

const svg = (children) => (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">{children}</svg>
);
// ▶ פונה ימינה ונקרא בעברית כמו "אחורה", ו-‹ › מתהפכים ע"י ה-bidi
const PLAY_ICON = svg(<path d="M16 4 L6 12 L16 20 Z" fill="currentColor" />);
const PAUSE_ICON = svg(<path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />);
const CHEV_R = svg(<path d="M9 4 L17 12 L9 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />);
const CHEV_L = svg(<path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />);

const FULL_VB = { x: 0, y: 0, w: MAP_SIZE, h: MAP_SIZE };
const ZOOM = 2.1;          // מידת ההתקרבות בעת "טיסה" לתחנה
export const PLAY_MS = 8000; // שהייה בכל תחנה - ארוכה דיה כדי להספיק לקרוא

// חלון תצוגה ממורכז סביב תחנה, חסום לגבולות המפה
export function windowFor(p) {
  const w = MAP_SIZE / ZOOM, h = MAP_SIZE / ZOOM;
  return {
    x: Math.max(0, Math.min(MAP_SIZE - w, p.x - w / 2)),
    y: Math.max(0, Math.min(MAP_SIZE - h, p.y - h / 2)),
    w, h,
  };
}

export default function JourneyMap({
  item, variant = 'timeline', onClose, initialStep = -1, onStep,
  docked = false, minimized = false, onToggleMin,
}) {
  const [step, setStep] = useState(initialStep);   // -1 = מבט-על; 0..N-1 = תחנה
  const [playing, setPlaying] = useState(false);
  const [vb, setVb] = useState(FULL_VB);
  const vbRef = useRef(FULL_VB);
  const rafRef = useRef(0);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const initialStepRef = useRef(initialStep);
  initialStepRef.current = initialStep;

  const data = item && maps[item.id];
  const color = KIND_COLOR[item && item.kind] || '#b28a2b';
  const pts = data ? journeyStations(data) : [];
  const total = pts.length ? pts[pts.length - 1].cum : 0;
  const pathPts = pts.map((p) => `${p.x},${p.y}`).join(' ');

  useEffect(() => {
    setStep(initialStepRef.current); setPlaying(false); setVb(FULL_VB); vbRef.current = FULL_VB;
  }, [item]);

  useEffect(() => { if (onStepRef.current) onStepRef.current(step); }, [step]);

  useEffect(() => {
    if (!onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // "טיסה" חלקה של המצלמה אל התחנה הפעילה (או חזרה למבט-על).
  // רשת ביטחון: בלשונית שאינה מקומפזת (רקע, חלונית מוסתרת) rAF אינו רץ כלל,
  // והמצלמה הייתה נתקעת במבט-על בלי שאיש ישים לב. אם לא הגיע פריים -
  // קופצים ישר ליעד.
  useEffect(() => {
    const target = step >= 0 && pts[step] ? windowFor(pts[step]) : FULL_VB;
    const start = vbRef.current;
    const t0 = performance.now();
    const dur = 550;
    let arrived = false;
    const land = (v) => { vbRef.current = v; setVb(v); };
    cancelAnimationFrame(rafRef.current);
    const tick = (t) => {
      const e = Math.min(1, (t - t0) / dur);
      const k = 1 - Math.pow(1 - e, 3); // easeOutCubic
      land({
        x: start.x + (target.x - start.x) * k,
        y: start.y + (target.y - start.y) * k,
        w: start.w + (target.w - start.w) * k,
        h: start.h + (target.h - start.h) * k,
      });
      if (e < 1) rafRef.current = requestAnimationFrame(tick);
      else arrived = true;
    };
    rafRef.current = requestAnimationFrame(tick);
    const safety = setTimeout(() => { if (!arrived) { cancelAnimationFrame(rafRef.current); land(target); } }, dur + 120);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(safety); };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= pts.length - 1) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setStep((s) => s + 1), PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, step, pts.length]);

  if (!data) return null;

  if (docked && minimized) {
    return (
      <button className="map-strip" onClick={onToggleMin} title="הצגת מפת המסע">
        <span className="map-strip-icon" aria-hidden="true">📍</span>
        <span className="map-strip-text">מפת המסע</span>
      </button>
    );
  }

  const active = step >= 0 ? pts[step] : null;
  // ההתקדמות נמדדת באורך המסלול ולא במספר התחנות; אחרת הקו חוצה את היעד
  const progressOffset = step < 0 ? total : total - pts[step].cum;

  const next = () => { setPlaying(false); setStep((s) => Math.min(pts.length - 1, s < 0 ? 0 : s + 1)); };
  const prev = () => { setPlaying(false); setStep((s) => (s <= 0 ? -1 : s - 1)); };
  const overview = () => { setPlaying(false); setStep(-1); };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (step < 0 || step >= pts.length - 1) setStep(0);
    setPlaying(true);
  };

  const panel = (
    <aside
      className={`map-panel jm-${variant}${docked ? ' docked' : ''}`}
      onClick={onClose && !docked ? (e) => e.stopPropagation() : undefined}
    >
      {docked && onToggleMin && (
        <button className="map-min" onClick={onToggleMin} aria-label="מזעור המפה" title="מזעור">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
            <path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {onClose && !docked && <button className="map-close" onClick={onClose} aria-label="סגירה">✕</button>}

      <h3 className="map-title">{data.title}</h3>
      <p className="map-sub">עקבו אחר המסע שלב-אחר-שלב, או לחצו על נקודה במפה</p>

      <div className="journey-controls">
        <button className="jc-btn jc-play" onClick={togglePlay}>
          <span className="jc-ico" aria-hidden="true">{playing ? PAUSE_ICON : PLAY_ICON}</span>
          {playing ? 'השהיה' : step < 0 ? 'הפעלת המסע' : 'המשך'}
        </button>
        <button className="jc-btn jc-nav" onClick={prev} disabled={step < 0}>
          <span className="jc-ico" aria-hidden="true">{CHEV_R}</span>הקודם
        </button>
        <button className="jc-btn jc-nav" onClick={next} disabled={step >= pts.length - 1}>
          הבא<span className="jc-ico" aria-hidden="true">{CHEV_L}</span>
        </button>
        {step >= 0 && <button className="jc-btn jc-all" onClick={overview}>הצג הכל</button>}
        <span className="jc-progress">{step < 0 ? 'סקירה כללית' : `תחנה ${step + 1} מתוך ${pts.length}`}</span>
      </div>

      <div className="map-wrap">
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="map-svg"
          preserveAspectRatio="xMidYMid slice"
          role="img" aria-label={`מפת ארץ ישראל עם תחנות המסע${item ? ' של ' + item.name : ''}`}
        >
          <image href={MAP_SRC} x="0" y="0" width={MAP_SIZE} height={MAP_SIZE} />
          <polyline points={pathPts} className="journey" style={{ opacity: step < 0 ? 0.75 : 0.28 }} />
          <polyline points={pathPts} className="journey-progress" stroke={color}
            style={{ strokeDasharray: total, strokeDashoffset: progressOffset }} />
          {pts.map((p, i) => {
            const isActive = step >= 0 && i === step;
            const isFuture = step >= 0 && i > step;
            return (
              <g key={p.id} className={`marker ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`}
                onClick={() => { setPlaying(false); setStep(i); }} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="16"
                  fill={isFuture ? '#fbf5e7' : color}
                  stroke={isActive ? undefined : isFuture ? color : '#fff'}
                  strokeWidth={isActive ? undefined : 3} />
                <text x={p.x} y={p.y} dy=".33em" textAnchor="middle" className="marker-num"
                  fill={isFuture ? color : undefined}>{p.order}</text>
              </g>
            );
          })}
        </svg>

        {active && (() => {
          const xPct = ((active.x - vb.x) / vb.w) * 100;
          const yPct = ((active.y - vb.y) / vb.h) * 100;
          const tx = xPct < 30 ? '-6%' : xPct > 70 ? '-94%' : '-50%';
          const ty = yPct < 35 ? '18px' : 'calc(-100% - 18px)';
          return (
            <div className="map-popup" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: `translate(${tx}, ${ty})` }}>
              <div className="map-popup-head" style={{ background: color }}>
                <span className="map-popup-num">{active.order}</span>{active.name}
              </div>
              <div className="map-popup-label">{active.label}</div>
              <p className="map-popup-desc">{active.desc}</p>
            </div>
          );
        })()}
      </div>

      <ol className="map-legend">
        {pts.map((p, i) => (
          <li key={p.id} className={i === step ? 'active' : ''} onClick={() => { setPlaying(false); setStep(i); }}>
            <span className="map-legend-num" style={{ background: color }}>{p.order}</span>
            <span><b>{p.name}</b> - {p.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  );

  return onClose && !docked ? <div className="map-overlay" onClick={onClose}>{panel}</div> : panel;
}
