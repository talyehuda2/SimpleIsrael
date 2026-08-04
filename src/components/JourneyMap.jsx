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

const ZOOM = 2.1;          // מידת ההתקרבות בעת "טיסה" לתחנה
export const PLAY_MS = 8000; // שהייה בכל תחנה - ארוכה דיה כדי להספיק לקרוא
// טבעת הספירה יושבת מחוץ לסמן (r=16) ומצוירת ביחידות המפה, ולכן היא
// מתקרבת ומתרחקת יחד איתו בזום.
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

const clampN = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* חלון תצוגה ביחס-הגובה-רוחב של המכל, ממורכז סביב נקודה וחסום לגבולות
   התמונה. היחס חשוב: התמונה ריבועית, ואם ה-viewBox ריבועי בזמן שהמכל
   רחב - preserveAspectRatio=slice חותך את החלק העליון והתחתון, ותחנות
   בדרום פשוט נעלמות. כשהיחסים זהים, slice אינו חותך דבר מעבר ל-viewBox. */
/* סריקה על כל 92 המסעות הראתה שמחוץ לתחום 0.72-1.1 מתחילות להיחתך תחנות
   (חרן בצפון ומצרים בדרום אינם נכנסים יחד לחלון רחב). מעבר לגבול עדיף
   לחתוך מעט מהים והמדבר בצדדים מאשר להעלים תחנה. */
const AR_MIN = 0.72, AR_MAX = 1.1;

function windowAt(cx, cy, span, arRaw) {
  const ar = clampN(arRaw, AR_MIN, AR_MAX);
  let w = span, h = span;
  if (ar >= 1) h = span / ar; else w = span * ar;
  w = Math.min(w, MAP_SIZE); h = Math.min(h, MAP_SIZE);
  return {
    x: clampN(cx - w / 2, 0, MAP_SIZE - w),
    y: clampN(cy - h / 2, 0, MAP_SIZE - h),
    w, h,
  };
}

// התקרבות לתחנה
export const windowFor = (p, ar = 1) => windowAt(p.x, p.y, MAP_SIZE / ZOOM, ar);

/* מבט-על: הזום המרבי (כל המפה) ביחס המכל, ממוקם כך שכל תחנות המסע
   ייכללו בו. אין כאן מסגור לפי דמות - הזום זהה לכולם, רק ההיסט משתנה
   כדי שלא ייחתכו תחנות. */
export function overviewFor(pts, ar = 1) {
  if (!pts.length) return windowAt(MAP_SIZE / 2, MAP_SIZE / 2, MAP_SIZE, ar);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return windowAt(cx, cy, MAP_SIZE, ar);
}

export default function JourneyMap({
  item, variant = 'timeline', onClose, initialStep = -1, onStep,
  docked = false, minimized = false, onToggleMin,
}) {
  const [step, setStep] = useState(initialStep);   // -1 = מבט-על; 0..N-1 = תחנה
  const [playing, setPlaying] = useState(false);
  // טבעת הספירה מוצגת רק כשהמסע רץ אוטומטית (או מושהה באמצעו)
  const [timerOn, setTimerOn] = useState(false);
  const [vb, setVb] = useState(() => overviewFor([], 1));
  const vbRef = useRef(null);
  // יחס הגובה-רוחב של חלון המפה. ה-viewBox נגזר ממנו, ולכן שינוי גודל
  // חלון הדפדפן מחייב חישוב מחדש - אחרת נחתכות תחנות.
  const wrapRef = useRef(null);
  const [ar, setAr] = useState(1);
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
  // ptsRef/arRef נקראים מתוך אפקטים שאינם תלויים בהם, כדי לא להריץ אותם
  // מחדש בכל רינדור (המערך נבנה מחדש בכל פעם).
  const ptsRef = useRef(pts); ptsRef.current = pts;
  const arRef = useRef(ar); arRef.current = ar;

  // מדידת יחס חלון המפה. בלעדיה ה-viewBox היה ריבועי בתוך מכל רחב,
  // ו-slice היה חותך את צפון ודרום המפה יחד עם התחנות שבהם.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const b = el.getBoundingClientRect();
      if (b.width > 8 && b.height > 8) setAr(b.width / b.height);
    };
    measure();
    if (typeof ResizeObserver !== 'function') {
      addEventListener('resize', measure);
      return () => removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ov = overviewFor(ptsRef.current, arRef.current);
    setStep(initialStepRef.current); setPlaying(false); setTimerOn(false); setVb(ov); vbRef.current = ov;
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
    const target = step >= 0 && pts[step] ? windowFor(pts[step], ar) : overviewFor(pts, ar);
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
  }, [step, ar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return undefined;
    if (step >= pts.length - 1) { setPlaying(false); setTimerOn(false); return undefined; }
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

  // מעבר ידני מכבה את הטיימר (אין ספירה), אבל "השהיה" משאיר את הטבעת
  // קפואה במקומה - כדי שיהיה ברור שהמסע ממתין ולא נגמר.
  const goManual = (fn) => { setPlaying(false); setTimerOn(false); fn(); };
  const next = () => goManual(() => setStep((s) => Math.min(pts.length - 1, s < 0 ? 0 : s + 1)));
  const prev = () => goManual(() => setStep((s) => (s <= 0 ? -1 : s - 1)));
  const overview = () => goManual(() => setStep(-1));
  const pickStation = (i) => goManual(() => setStep(i));
  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }   // השהיה - הטבעת נשארת ונעצרת
    if (step < 0 || step >= pts.length - 1) setStep(0);
    setPlaying(true); setTimerOn(true);
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

      <div className="map-wrap" ref={wrapRef}>
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="map-svg"
          preserveAspectRatio="xMidYMid slice"
          role="img" aria-label={`מפת ארץ ישראל עם תחנות המסע${item ? ' של ' + item.name : ''}`}
        >
          <image href={MAP_SRC} x="0" y="0" width={MAP_SIZE} height={MAP_SIZE} />
          <polyline points={pathPts} className="journey" style={{ opacity: step < 0 ? 0.75 : 0.28 }} />
          <polyline points={pathPts} className="journey-progress" stroke={color}
            style={{ strokeDasharray: total, strokeDashoffset: progressOffset }} />
          {/* טבעת הספירה סביב התחנה הפעילה: מתרוקנת לאורך 8 השניות ומראה
              כמה נשאר עד הקפיצה הבאה. key={step} מאתחל אותה בכל תחנה,
              והיא קופאת בהשהיה במקום להיעלם. */}
          {timerOn && active && (
            <g className="jm-timer" aria-hidden="true">
              <circle className="jm-timer-track" cx={active.x} cy={active.y} r={RING_R} />
              <circle
                key={step} className="jm-timer-arc"
                cx={active.x} cy={active.y} r={RING_R}
                transform={`rotate(-90 ${active.x} ${active.y})`}
                style={{
                  strokeDasharray: RING_C, '--ring-c': RING_C,
                  animationDuration: `${PLAY_MS}ms`,
                  animationPlayState: playing ? 'running' : 'paused',
                }}
              />
            </g>
          )}
          {pts.map((p, i) => {
            const isActive = step >= 0 && i === step;
            const isFuture = step >= 0 && i > step;
            return (
              <g key={p.id} className={`marker ${isActive ? 'active' : ''} ${isFuture ? 'future' : ''}`}
                onClick={() => pickStation(i)} style={{ cursor: 'pointer' }}>
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
          <li key={p.id} className={i === step ? 'active' : ''} onClick={() => pickStation(i)}>
            <span className="map-legend-num" style={{ background: color }}>{p.order}</span>
            <span><b>{p.name}</b> - {p.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  );

  // רק בציר הזמן המפה צפה מעל הדף וזקוקה להחשכה מאחוריה. במסע הדורות
  // חלון המפה כבר תופס את המסך כולו, ושכבה נוספת רק החשיכה אותו.
  const needsScrim = variant === 'timeline' && onClose && !docked;
  return needsScrim ? <div className="map-overlay" onClick={onClose}>{panel}</div> : panel;
}
