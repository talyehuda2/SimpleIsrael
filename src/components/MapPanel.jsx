import { useState, useEffect } from 'react';
import maps from '../data/maps.json';

const KIND_COLOR = {
  leader: '#9c2b50', judge: '#8a5a2b', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

// מפת רקע עתיקה של ארץ ישראל (סכמטית) — ים, ירדן, כנרת, ים המלח, אזורים
// אזור הררי: מילוי חום בהיר + קווי מתאר פנימיים (תחושת טופוגרפיה)
function Highland({ cx, cy, rx, ry }) {
  return (
    <g className="map-hill">
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      <ellipse cx={cx} cy={cy} rx={rx * 0.66} ry={ry * 0.66} fill="none" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.36} ry={ry * 0.36} fill="none" />
    </g>
  );
}

// פסגה בעלת שם — משולש קטן ותווית
function Peak({ x, y, name }) {
  return (
    <g className="map-peak">
      <path d={`M${x},${y - 7} L${x + 6},${y + 4} L${x - 6},${y + 4} Z`} />
      {name && <text x={x} y={y + 15}>{name}</text>}
    </g>
  );
}

function BaseMap() {
  return (
    <g>
      {/* בסיס יבשה */}
      <rect x="0" y="0" width="500" height="720" fill="#efe4cb" />

      {/* אזורי הר עם קווי מתאר */}
      <Highland cx={312} cy={128} rx={58} ry={46} />   {/* הרי הגליל */}
      <Highland cx={305} cy={306} rx={50} ry={58} />   {/* הרי השומרון */}
      <Highland cx={300} cy={470} rx={48} ry={66} />   {/* הרי יהודה */}
      <Highland cx={420} cy={330} rx={34} ry={92} />   {/* הרי הגלעד (עבר הירדן) */}

      {/* הים הגדול (הים התיכון) — קו חוף עם בליטת הכרמל ומפרץ חיפה */}
      <path d="M196,-5 C190,120 178,180 172,206 C160,222 176,244 160,300
               C150,356 128,430 108,506 C100,556 92,604 84,700 L-5,700 L-5,-5 Z"
        fill="#a7c6ce" stroke="#7c9aa0" strokeWidth="1.6" />
      <path d="M40,150 q15,-7 30,0 t30,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".55" />
      <path d="M32,250 q15,-7 30,0 t30,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".55" />
      <path d="M28,352 q15,-7 30,0 t30,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".55" />

      {/* נהר הירדן — מתפתל מהחולה דרך הכנרת אל ים המלח */}
      <path d="M340,108 C347,132 331,150 338,176 C347,206 330,250 344,300 C356,346 335,378 350,408"
        fill="none" stroke="#5b86a6" strokeWidth="2.6" strokeLinecap="round" />
      {/* נחל קישון (אל מפרץ חיפה) */}
      <path d="M300,196 C258,206 210,214 170,216" fill="none" stroke="#6c97b3" strokeWidth="1.6" opacity=".85" />
      {/* נחל יבוק (עבר הירדן אל הירדן) */}
      <path d="M418,268 C392,276 366,286 348,296" fill="none" stroke="#6c97b3" strokeWidth="1.5" opacity=".8" />

      {/* אגם החולה */}
      <ellipse cx="342" cy="96" rx="8" ry="12" fill="#8bb0bd" stroke="#5f8792" strokeWidth="1.2" />
      {/* ים כנרת — צורת כינור */}
      <path d="M322,138 Q340,127 357,141 Q362,160 349,178 Q338,186 330,176 Q320,160 322,138 Z"
        fill="#8bb0bd" stroke="#5f8792" strokeWidth="1.4" />
      {/* ים המלח — מוארך עם בליטת לשון הים במזרח */}
      <path d="M340,412 Q358,414 356,450 Q368,460 356,472 Q360,512 348,538 Q336,512 340,472 Q339,450 340,412 Z"
        fill="#8bb0bd" stroke="#5f8792" strokeWidth="1.4" />

      {/* פסגות (רק היכן שאין סמני מסלול) */}
      <Peak x={368} y={46} name="חרמון" />
      <Peak x={182} y={210} name="כרמל" />

      {/* תוויות אזורים */}
      <g className="map-region">
        <text x="312" y="120">הגליל</text>
        <text x="262" y="246">עמק יזרעאל</text>
        <text x="308" y="312">השומרון</text>
        <text x="150" y="474">פלשת</text>
        <text x="300" y="474">יהודה</text>
        <text x="424" y="336">הגלעד</text>
        <text x="250" y="640">הנגב</text>
        <text x="50" y="380" className="map-sea">הים הגדול</text>
      </g>

      {/* מצפן */}
      <g transform="translate(452,56)">
        <circle r="18" fill="none" stroke="#b28a2b" strokeWidth="1.2" />
        <path d="M0,-16 L4,0 L0,16 L-4,0 Z" fill="#b28a2b" />
        <text x="0" y="-22" className="map-compass">צ</text>
      </g>
      {/* מסגרת זהב כפולה */}
      <rect x="7" y="7" width="486" height="706" fill="none" stroke="#b28a2b" strokeWidth="3" />
      <rect x="14" y="14" width="472" height="692" fill="none" stroke="#d8b755" strokeWidth="1" />
    </g>
  );
}

export default function MapPanel({ item, onClose }) {
  const data = item && maps[item.id];
  const [active, setActive] = useState(null);

  // איפוס הנקודה הפעילה ומקש Esc בכל פתיחה
  useEffect(() => {
    setActive(null);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!data) return null;
  const color = KIND_COLOR[item.kind] || '#b28a2b';
  const path = data.points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="map-overlay" onClick={onClose}>
      <aside className="map-panel" onClick={(e) => e.stopPropagation()}>
        <button className="map-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h3 className="map-title">{data.title}</h3>
        <p className="map-sub">לחצו על נקודה במפה כדי לקרוא על מה שאירע בה</p>

        <div className="map-wrap">
          <svg viewBox="0 0 500 720" className="map-svg" preserveAspectRatio="xMidYMid meet">
            <BaseMap />
            {/* קו המסלול הכרונולוגי */}
            <polyline points={path} className="journey" />
            {/* סמנים ממוספרים */}
            {data.points.map((p) => (
              <g key={p.id} className={`marker ${active && active.id === p.id ? 'active' : ''}`}
                onClick={() => setActive(p)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="13" fill={color} stroke="#fff" strokeWidth="2.5" />
                <text x={p.x} y={p.y} dy=".33em" textAnchor="middle" className="marker-num">{p.order}</text>
              </g>
            ))}
          </svg>

          {active && (
            <div className="map-popup" style={{ left: `${(active.x / 500) * 100}%`, top: `${(active.y / 720) * 100}%` }}>
              <button className="map-popup-close" onClick={() => setActive(null)} aria-label="סגירה">✕</button>
              <div className="map-popup-head" style={{ background: color }}>
                <span className="map-popup-num">{active.order}</span>{active.name}
              </div>
              <div className="map-popup-label">{active.label}</div>
              <p className="map-popup-desc">{active.desc}</p>
            </div>
          )}
        </div>

        {/* מקרא נקודות */}
        <ol className="map-legend">
          {data.points.map((p) => (
            <li key={p.id} className={active && active.id === p.id ? 'active' : ''} onClick={() => setActive(p)}>
              <span className="map-legend-num" style={{ background: color }}>{p.order}</span>
              <span><b>{p.name}</b> — {p.label}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
