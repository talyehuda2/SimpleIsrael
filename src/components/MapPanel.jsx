import { useState, useEffect, useRef } from 'react';
import maps from '../data/maps.json';

const KIND_COLOR = {
  leader: '#9c2b50', judge: '#bd7038', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

// ממדי תמונת המפה (מוקטנת מ-1684x2528)
const IMG_W = 820;
const IMG_H = 1231;

// היטל אפיני lat/lon -> פיקסלים, שהותאם (least-squares) לערים המסומנות על המפה
const projX = (lon, lat) => 226.10 * lon + 21.00 * lat - 8226.5;
const projY = (lon, lat) => -38.05 * lon - 311.53 * lat + 11836.5;

const FULL_VB = { x: 0, y: 0, w: IMG_W, h: IMG_H };
const ZOOM = 1.7;          // מידת ההתקרבות בעת "טיסה" לתחנה
const PLAY_MS = 2300;      // קצב ההשמעה האוטומטית

// חלון תצוגה (viewBox) ממורכז סביב נקודה, מוגבל לגבולות המפה
function windowFor(p) {
  const w = IMG_W / ZOOM, h = IMG_H / ZOOM;
  const x = Math.max(0, Math.min(IMG_W - w, p.x - w / 2));
  const y = Math.max(0, Math.min(IMG_H - h, p.y - h / 2));
  return { x, y, w, h };
}

export default function MapPanel({ item, onClose, initialStep = -1, onStep }) {
  const [step, setStep] = useState(initialStep);   // -1 = סקירה כללית; 0..N-1 = תחנה במסע
  const [playing, setPlaying] = useState(false);
  const [vb, setVb] = useState(FULL_VB);
  const vbRef = useRef(FULL_VB);
  const rafRef = useRef(0);
  // דיווח התחנה הנוכחית כלפי מעלה (לסנכרון עם כתובת ה-URL)
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const initialStepRef = useRef(initialStep);
  initialStepRef.current = initialStep;

  const data = item && maps[item.id];
  const color = KIND_COLOR[item && item.kind] || '#b28a2b';
  const pts = data ? data.points.map((p) => ({
    ...p,
    x: p.x != null ? p.x : projX(p.lon, p.lat) + (p.dx || 0),
    y: p.y != null ? p.y : projY(p.lon, p.lat) + (p.dy || 0),
  })) : [];
  // אורכי מסלול מצטברים (עבור מתיחת קו ההתקדמות)
  let total = 0;
  const cum = pts.map((p, i) => { if (i > 0) total += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); return total; });
  const pathPts = pts.map((p) => `${p.x},${p.y}`).join(' ');

  // איפוס בכל פתיחה של דמות אחרת (או פתיחה בתחנה מסוימת מכתובת משותפת)
  useEffect(() => {
    setStep(initialStepRef.current); setPlaying(false); setVb(FULL_VB); vbRef.current = FULL_VB;
  }, [item]);

  // עדכון הכתובת בכל מעבר תחנה
  useEffect(() => {
    if (onStepRef.current) onStepRef.current(step);
  }, [step]);

  // מקש Esc לסגירה
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // "טיסה" חלקה של ה-viewBox אל התחנה הפעילה (או חזרה לסקירה מלאה)
  useEffect(() => {
    const target = step >= 0 && pts[step] ? windowFor(pts[step]) : FULL_VB;
    const start = vbRef.current;
    const t0 = performance.now();
    const dur = 550;
    cancelAnimationFrame(rafRef.current);
    const tick = (t) => {
      const e = Math.min(1, (t - t0) / dur);
      const k = 1 - Math.pow(1 - e, 3); // easeOutCubic
      const v = {
        x: start.x + (target.x - start.x) * k,
        y: start.y + (target.y - start.y) * k,
        w: start.w + (target.w - start.w) * k,
        h: start.h + (target.h - start.h) * k,
      };
      vbRef.current = v; setVb(v);
      if (e < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // השמעה אוטומטית
  useEffect(() => {
    if (!playing) return undefined;
    if (step >= pts.length - 1) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setStep((s) => s + 1), PLAY_MS);
    return () => clearTimeout(id);
  }, [playing, step, pts.length]);

  if (!data) return null;

  const active = step >= 0 ? pts[step] : null;
  const progressOffset = step < 0 ? total : total - cum[step];

  const next = () => { setPlaying(false); setStep((s) => Math.min(pts.length - 1, s < 0 ? 0 : s + 1)); };
  const prev = () => { setPlaying(false); setStep((s) => (s <= 0 ? -1 : s - 1)); };
  const overview = () => { setPlaying(false); setStep(-1); };
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    if (step < 0 || step >= pts.length - 1) setStep(0);
    setPlaying(true);
  };

  return (
    <div className="map-overlay" onClick={onClose}>
      <aside className="map-panel" onClick={(e) => e.stopPropagation()}>
        <button className="map-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h3 className="map-title">{data.title}</h3>
        <p className="map-sub">עקבו אחר המסע שלב-אחר-שלב, או לחצו על נקודה במפה</p>

        <div className="journey-controls">
          <button className="jc-btn jc-play" onClick={togglePlay}>
            {playing ? '⏸ השהיה' : step < 0 ? 'הפעלת המסע' : 'המשך'}
          </button>
          <button className="jc-btn jc-nav" onClick={prev} disabled={step < 0}>
            <span className="jc-ar" aria-hidden="true">‹</span>הקודם
          </button>
          <button className="jc-btn jc-nav" onClick={next} disabled={step >= pts.length - 1}>
            הבא<span className="jc-ar" aria-hidden="true">›</span>
          </button>
          {step >= 0 && <button className="jc-btn jc-all" onClick={overview}>הצג הכל</button>}
          <span className="jc-progress">{step < 0 ? 'סקירה כללית' : `תחנה ${step + 1} מתוך ${pts.length}`}</span>
        </div>

        <div className="map-wrap">
          <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="map-svg" preserveAspectRatio="xMidYMid meet"
               role="img" aria-label={`מפת ארץ ישראל עם תחנות המסע${item ? ' של ' + item.name : ''}`}>
            <image href="/israel-map.jpg" x="0" y="0" width={IMG_W} height={IMG_H} />
            {/* קו התכנון — כל המסלול, מקווקו וחלש */}
            <polyline points={pathPts} className="journey" style={{ opacity: step < 0 ? 0.75 : 0.28 }} />
            {/* קו ההתקדמות — נמתח בהדרגה עד התחנה הנוכחית */}
            <polyline points={pathPts} className="journey-progress" stroke={color}
              style={{ strokeDasharray: total, strokeDashoffset: progressOffset }} />
            {/* סמנים ממוספרים */}
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

        {/* מקרא נקודות */}
        <ol className="map-legend">
          {data.points.map((p, i) => (
            <li key={p.id} className={i === step ? 'active' : ''} onClick={() => { setPlaying(false); setStep(i); }}>
              <span className="map-legend-num" style={{ background: color }}>{p.order}</span>
              <span><b>{p.name}</b> — {p.label}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
