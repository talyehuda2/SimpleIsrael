import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* סיור זרקור: מדגיש אזור אמיתי במסך ומסביר אותו, במקום שקפים מנותקים
   שמלמדים על ממשק שלא רואים. כל שלב מצביע על אלמנט קיים; אם הוא חסר או
   מחוץ למסך (למשל כרטיס סגור) השלב מדולג, כדי שלא תצויר טבעת סביב ריק. */

const PAD = 6;
const MARGIN = 4;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// בורר עם כמה חלופות מופרדות בפסיק נבדק אחת-אחת ולא ב-querySelector אחד:
// זה מחזיר את הראשון בסדר המסמך, וגם אם הוא מוסתר (המקרא במובייל) - ואז
// היינו מדלגים על השלב במקום ליפול לחלופה שכן מוצגת.
function firstVisible(sel) {
  if (typeof sel === 'function') return sel();
  for (const part of sel.split(',')) {
    for (const el of document.querySelectorAll(part.trim())) {
      const r = el.getBoundingClientRect();
      if (r.width >= 8 && r.height >= 8) return el;
    }
  }
  return null;
}

// המלבן של היעד, חתוך לגבולות החלון. מחזיר null אם הוא כולו מחוץ למסך.
function targetRect(sel) {
  const el = firstVisible(sel);
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

  // מריצים את ההכנה של השלב (למשל פתיחת כרטיס), מגלגלים את היעד לאמצע
  // ואז מודדים. בלי הגלילה שלב כמו "בני-הזמן", שיושב בתחתית כרטיס נגלל,
  // קיבל טבעת בקצה המסך או דולג לגמרי.
  useEffect(() => {
    const st = stepsRef.current[i];
    if (!st) { doneRef.current(); return undefined; }
    setReady(false);
    st.before?.();
    let t2 = null;
    const t = setTimeout(() => {
      const el = firstVisible(st.sel);
      if (el) { try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch { /* דפדפן ישן */ } }
      t2 = setTimeout(() => {
        const r = targetRect(st.sel);
        if (!r) { setI((v) => (v === i ? v + 1 : v)); return; }   // אזור שאינו מוצג במסך הזה
        setRect(r); setReady(true);
      }, 140);
    }, st.before ? 450 : 40);
    return () => { clearTimeout(t); clearTimeout(t2); };
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
    // right ב-CSS נמדד מקצה החלון הימני. כדי להצמיד את התיבה *מימין* ליעד,
    // הקצה הימני שלה צריך לשבת ב-VW-rect.left; כדי להצמידה *משמאלו*,
    // הקצה השמאלי שלה צריך לשבת ב-rect.right, כלומר right = freeR-bw-14.
    const freeR = VW - rect.right, freeL = rect.left;
    if (freeR >= freeL && freeR > bw + 20) setBoxPos({ right: right(freeR - bw - 14), top: top(rect.top) });
    else if (freeL > bw + 20) setBoxPos({ right: right(VW - rect.left + 14), top: top(rect.top) });
    else {
      // אין צד פנוי (מסך צר). ליעד קטן מציבים מתחתיו או מעליו כדי לא לכסות
      // אותו; ליעד שממלא את המסך אין ברירה והתיבה נכנסת לתוכו, בתחתיתו.
      const below = rect.bottom + 12, above = rect.top - bh - 12;
      const y = below + bh + 12 <= VH ? below : (above >= 12 ? above : rect.bottom - bh - 14);
      setBoxPos({ right: right(VW - rect.right + (rect.width - bw) / 2), top: top(y) });
    }
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
