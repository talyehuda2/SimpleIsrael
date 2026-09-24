import { useEffect, useMemo } from 'react';
import KINGS from '../data/kings.json';
import './KingsChart.css';

/* שתי הממלכות - מלכי יהודה מול מלכי ישראל, על ציר אנכי אחד.

   מה שהמסך הזה עונה עליו ואילן היוחסין לא: כמה זמן כל אחד מלך, ומי
   ישב על הכיסא השני באותה שנה. גובה התיבה הוא שנות המלוכה, ולכן מנשה
   (55 שנה) הוא תיבה ארוכה וזמרי (7 ימים) הוא פס דק - וההבדל נראה בלי
   לקרוא מספר אחד.

   שתי החלטות שכדאי להכיר:

   1. גובה מזערי. מלך שמלך חודשיים היה מקבל תיבה של אפס פיקסלים, ולכן
      שמו לא היה נקרא כלל. לכן כל תיבה מקבלת MIN_H לפחות. המחיר: טור
      שיש בו מלכים קצרים מתארך מעט מעבר לאורך "האמיתי" שלו, והמלכים
      שאחריהם נדחפים למטה. אצל ישראל, שיש בה שבעה מלכים קצרים, ההיסט
      המצטבר בתחתית הטור הוא כעשר שנים.

   2. לכן אין כאן סרגל שנים "אמיתי" שיסתור את התיבות. מיקום כל שנה על
      הציר מחושב מתוך טור יהודה עצמו (yOf), ושלושת הציוני דרך מעוגנים
      לקצה הטור שאליו הם שייכים: הפילוג לראש, גלות עשרת השבטים לתחתית
      טור ישראל, והחורבן לתחתית טור יהודה. כך שום סימון אינו סותר שום
      תיבה.

   הממלכה המאוחדת (שאול, דוד, שלמה) פותחת את המסך, בתיבות ברוחב שני
   הטורים ובאותו קנה מידה: לפני הפילוג היה כיסא אחד. קודם היא הייתה שורת
   שבבים מעל הציר, ואז ארבעים שנות דוד נראו כמו שבב אחד ליד זמרי. */

const MIN_H = 19;                       // גובה מזערי לתיבה, כדי ששם המלך ייקרא
const SPLIT = 2964;                     // פילוג הממלכה - ראש הציר
const JUDGMENT = { good: 'עשה הישר בעיני ה\'', bad: 'עשה הרע בעיני ה\'', mixed: 'מעורב' };

// צפיפות הציר. במסך צר אין מקום לאותו קנה מידה, ולכן הוא מתכווץ.
const pxPerYear = () => (typeof window !== 'undefined' && window.innerWidth < 600 ? 6 : 8);

/* פריסת טור: תיבה לכל מלך לפי שנות מלוכתו, ומי שקצר מדי נדחף למטה
   במקום להיעלם. flow שומר על הסדר - תיבה לעולם לא מטפסת על קודמתה. */
function layout(list, py, origin = SPLIT) {
  let flow = 0;
  return list.map((k) => {
    const years = k.end - k.start;
    const h = Math.max(years * py, MIN_H);
    const top = Math.max((k.start - origin) * py, flow);
    flow = top + h;
    return { k, top, h, years, short: years * py < MIN_H };
  });
}

function Box({ b, realm, onJump }) {
  const { k, h } = b;
  const tier = h < 26 ? 'xs' : h < 52 ? 'sm' : 'lg';
  return (
    <button
      className={`kb ${realm} j-${k.judgment} t-${tier}${b.short ? ' short' : ''}`}
      style={{ top: `${b.top}px`, height: `${h}px` }}
      onClick={() => onJump(k.id)}
      title={`${k.name} · ${k.reignText} · ${JUDGMENT[k.judgment]} · קפיצה לכרטיס`}
    >
      {tier === 'xs' ? (
        <span className="kb-line">{k.name} · {k.reignText}</span>
      ) : (
        <>
          <span className="kb-name">{k.name}</span>
          <span className="kb-reign">{k.reignText}</span>
          {tier === 'lg' && <span className="kb-years" dir="ltr">{k.start}–{k.end}</span>}
        </>
      )}
    </button>
  );
}

export default function KingsChart({ open, onClose, onJump }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const view = useMemo(() => {
    const py = pxPerYear();
    const united = layout(KINGS.united, py, KINGS.united[0].start);
    const uEnd = united[united.length - 1];
    const judah = layout(KINGS.judah, py);
    const israel = layout(KINGS.israel, py);
    const jEnd = judah[judah.length - 1];
    const iEnd = israel[israel.length - 1];
    const height = Math.max(jEnd.top + jEnd.h, iEnd.top + iEnd.h);
    /* מיקום שנה על הציר - מתוך טור יהודה עצמו, ולא מחישוב נפרד שהיה
       נופל בדיוק על ההיסט של הגובה המזערי. */
    const yOf = (year) => {
      const b = judah.find((x) => year >= x.k.start && year < x.k.end) || jEnd;
      const span = b.k.end - b.k.start;
      return b.top + (span ? ((year - b.k.start) / span) * b.h : 0);
    };
    // ציון שנה כל 50 שנה, בשנים עגולות בתוך טווח הפילוג
    const ticks = [];
    for (let y = Math.ceil(SPLIT / 50) * 50; y < jEnd.k.end; y += 50) ticks.push({ y, top: yOf(y) });
    return { united, unitedHeight: uEnd.top + uEnd.h, judah, israel, height, ticks, israelEnd: iEnd.top + iEnd.h, judahEnd: jEnd.top + jEnd.h, exile: iEnd.k.end, churban: jEnd.k.end };
  }, [open]);

  if (!open) return null;

  return (
    <div className="kings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="שתי הממלכות">
      <div className="kings-panel" onClick={(e) => e.stopPropagation()}>
        <button className="kings-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h2>🏰 שתי הממלכות</h2>
        <p className="kings-sub">
          שלושת מלכי הממלכה המאוחדת, ואחריהם מלכי יהודה מול מלכי ישראל עד החורבן. גובה
          התיבה הוא שנות המלוכה, והשורה שממול היא מי שישב על הכיסא השני באותן שנים. לחיצה
          פותחת את הכרטיס המלא.
        </p>

        <div className="kings-head ku-head">
          <span className="kh united">👑 הממלכה המאוחדת</span>
        </div>
        <div className="kings-united" style={{ height: `${view.unitedHeight}px` }}>
          {view.united.map((b) => <Box key={b.k.id} b={b} realm="united" onJump={onJump} />)}
        </div>

        <div className="kings-split">▼ {SPLIT} · פילוג הממלכה</div>

        <div className="kings-head">
          <span className="kh judah">👑 מלכי יהודה</span>
          <span className="kh kh-axis">שנה לבריאה</span>
          <span className="kh israel">👑 מלכי ישראל</span>
        </div>

        <div className="kings-chart" style={{ height: `${view.height}px` }}>
          <div className="kcol">
            {view.judah.map((b) => <Box key={b.k.id} b={b} realm="judah" onJump={onJump} />)}
            <div className="kend judah" style={{ top: `${view.judahEnd}px` }}>
              <b>{view.churban} · חורבן בית ראשון</b>
              צדקיהו האחרון, ירושלים נשרפת, ויהודה גולה לבבל.
            </div>
          </div>

          <div className="kaxis">
            {view.ticks.map((t) => (
              <span className="ktick" key={t.y} style={{ top: `${t.top}px` }}>{t.y}</span>
            ))}
            <span className="kmark exile" style={{ top: `${view.israelEnd}px` }} />
            <span className="kmark churban" style={{ top: `${view.judahEnd}px` }} />
          </div>

          <div className="kcol">
            {view.israel.map((b) => <Box key={b.k.id} b={b} realm="israel" onJump={onJump} />)}
            <div className="kgone" style={{ top: `${view.israelEnd}px` }} aria-hidden="true" />
            <div className="kend israel" style={{ top: `${view.israelEnd}px` }}>
              <b>{view.exile} · שומרון נפלה</b>
              עשרת השבטים גלו לאשור, ומלכות ישראל אינה עוד.
            </div>
          </div>
        </div>

        <div className="kings-legend">
          <span className="kl"><i className="sw good" /> {JUDGMENT.good}</span>
          <span className="kl"><i className="sw mixed" /> {JUDGMENT.mixed}</span>
          <span className="kl"><i className="sw bad" /> {JUDGMENT.bad}</span>
          <span className="kl note">
            מלך שמלך פחות משנתיים מוצג בגובה מזערי כדי ששמו ייקרא, ולכן משך מלכותו
            המדויק כתוב בתוך כל תיבה.
          </span>
        </div>
      </div>
    </div>
  );
}
