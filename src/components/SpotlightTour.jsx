import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* סיור זרקור: מדגיש אזור אמיתי במסך ומסביר אותו, במקום שקפים מנותקים
   שמלמדים על ממשק שלא רואים. כל שלב מצביע על אלמנט קיים; אם הוא חסר או
   מחוץ למסך (למשל כרטיס סגור) השלב מדולג, כדי שלא תצויר טבעת סביב ריק. */

const PAD = 6;
const MARGIN = 4;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// המלבן של היעד, חתוך לגבולות החלון. מחזיר null אם הוא כולו מחוץ למסך.
function targetRect(sel) {
  const el = typeof sel === 'function' ? sel() : document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  // clientWidth ולא innerWidth - האחרון כולל את פס הגלילה, והשכבה לא
  const VW = document.documentElement.clientWidth;
  const VH = document.documentElement.clientHeight;
  if (r.bottom < 24 || r.top > VH - 24 || r.right < 24 || r.left > VW - 24) return null;
  const left = Math.max(MARGIN, r.left - PAD);
  const right = Math.min(VW - MARGIN, r.right + PAD);
  const top = Math.max(MARGIN, r.top - PAD);
  const bottom = Math.min(VH - MARGIN, r.bottom + PAD);
  return { left, top, right, bottom, width: right - left, height: bottom - top, VW, VH };
}

export default function SpotlightTour({ steps, onDone, layers, visible, setVisible }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const boxRef = useRef(null);
  const [boxPos, setBoxPos] = useState(null);

  const step = steps[i];
  // steps ו-onDone נוצרים מחדש בכל רינדור של ההורה. בלי הקיבוע הזה ה-effect
  // רץ שוב ושוב, מריץ שוב את before ומקדם את השלב פעמיים - והסיור "בורח".
  const stepsRef = useRef(steps);
  const doneRef = useRef(onDone);
  stepsRef.current = steps;
  doneRef.current = onDone;

  // מריצים את ההכנה של השלב (למשל פתיחת כרטיס) ואז מודדים
  useEffect(() => {
    const st = stepsRef.current[i];
    if (!st) { doneRef.current(); return undefined; }
    setReady(false);
    st.before?.();
    const t = setTimeout(() => {
      const r = targetRect(st.sel);
      if (!r) { setI((v) => (v === i ? v + 1 : v)); return; }   // אזור שאינו מוצג במסך הזה
      setRect(r); setReady(true);
    }, st.before ? 450 : 40);
    return () => clearTimeout(t);
  }, [i]);

  const reflow = useCallback(() => {
    const st = stepsRef.current[i];
    if (!st) return;
    const r = targetRect(st.sel);
    if (r) setRect(r);
  }, [i]);

  useEffect(() => {
    if (!ready) return undefined;
    addEventListener('resize', reflow);
    addEventListener('scroll', reflow, true);
    return () => { removeEventListener('resize', reflow); removeEventListener('scroll', reflow, true); };
  }, [ready, reflow]);

  // התיבה יושבת בצד הפנוי הגדול יותר, ואם אין כזה - בתחתית האזור
  useLayoutEffect(() => {
    if (!ready || !rect || !boxRef.current) return;
    const bw = boxRef.current.offsetWidth, bh = boxRef.current.offsetHeight;
    const { VW, VH } = rect;
    // חסימה לגבולות החלון בשני הצירים - יעד קטן בקצה יכול לדחוף את התיבה החוצה
    const top = (v) => clamp(v, 12, Math.max(12, VH - bh - 12));
    const right = (v) => clamp(v, 12, Math.max(12, VW - bw - 12));
    const freeR = VW - rect.right, freeL = rect.left;
    if (freeR >= freeL && freeR > bw + 20) setBoxPos({ right: right(freeR + 14), top: top(rect.top) });
    else if (freeL > bw + 20) setBoxPos({ right: right(VW - rect.left + 14), top: top(rect.top) });
    else setBoxPos({
      right: right(VW - rect.right + (rect.width - bw) / 2),
      top: top(rect.bottom - bh - 14),
    });
  }, [ready, rect]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') doneRef.current();
      else if (e.key === 'ArrowLeft' || e.key === 'Enter') setI((v) => v + 1);
      else if (e.key === 'ArrowRight') setI((v) => Math.max(0, v - 1));
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!step) return null;
  const last = i === steps.length - 1;
  // השכבה נשארת גם בזמן המדידה של השלב הבא; רק הזרקור והתיבה מתחלפים.
  // אחרת המסך "מהבהב" בכל לחיצה על הבא.
  if (!ready || !rect) return <div className="spot-wrap" />;

  return (
    <div className="spot-wrap" onClick={(e) => { if (e.target === e.currentTarget) onDone(); }}>
      <div
        className="spot-ring"
        style={{ top: rect.top, right: rect.VW - rect.right, width: rect.width, height: rect.height }}
      />
      <div className="spot-box" ref={boxRef} style={boxPos ? { top: boxPos.top, right: boxPos.right } : { visibility: 'hidden' }}>
        <b>{step.title}</b>
        <p>{step.text}</p>
        {step.picker && (
          <div className="spot-pick">
            {layers.map((l) => (
              <button
                key={l.key}
                className="spot-p"
                style={{ '--kc': l.color }}
                aria-pressed={!!visible[l.key]}
                onClick={() => setVisible({ ...visible, [l.key]: !visible[l.key] })}
              >
                <span className="gl" aria-hidden="true">{l.icon}</span>{l.label}
              </button>
            ))}
          </div>
        )}
        <div className="spot-nav">
          <span>{i + 1}/{steps.length}</span>
          <button onClick={onDone}>דילוג</button>
          <button className="primary" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'סיום' : 'הבא'}
          </button>
        </div>
      </div>
    </div>
  );
}
