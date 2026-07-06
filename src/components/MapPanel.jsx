import { useState, useEffect } from 'react';
import maps from '../data/maps.json';

const KIND_COLOR = {
  leader: '#9c2b50', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

// מפת רקע עתיקה של ארץ ישראל (סכמטית) — ים, ירדן, כנרת, ים המלח, אזורים
function BaseMap() {
  return (
    <g>
      {/* בסיס יבשה */}
      <rect x="0" y="0" width="500" height="720" fill="#efe4cb" />
      {/* הים הגדול (הים התיכון) */}
      <path d="M178,-5 C168,140 138,300 122,436 C114,506 106,548 98,624 L-5,664 L-5,-5 Z"
        fill="#a7c6ce" stroke="#7c9aa0" strokeWidth="1.5" />
      <path d="M35,150 q14,-7 28,0 t28,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".6" />
      <path d="M30,240 q14,-7 28,0 t28,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".6" />
      <path d="M28,330 q14,-7 28,0 t28,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".6" />
      {/* נהר הירדן */}
      <path d="M338,180 C351,236 330,300 352,392" fill="none" stroke="#5b86a6" strokeWidth="3" strokeLinecap="round" />
      {/* ים כנרת */}
      <ellipse cx="338" cy="153" rx="21" ry="29" fill="#8bb0bd" stroke="#5f8792" strokeWidth="1.4" />
      {/* ים המלח */}
      <ellipse cx="353" cy="448" rx="19" ry="55" fill="#8bb0bd" stroke="#5f8792" strokeWidth="1.4" />
      {/* תוויות אזורים */}
      <g className="map-region">
        <text x="305" y="118">הגליל</text>
        <text x="270" y="235">עמק יזרעאל</text>
        <text x="308" y="315">השומרון</text>
        <text x="150" y="470">פלשת</text>
        <text x="300" y="520">יהודה</text>
        <text x="428" y="345">עבר הירדן</text>
        <text x="250" y="628">הנגב</text>
        <text x="52" y="360" className="map-sea">הים הגדול</text>
      </g>
      {/* מצפן */}
      <g transform="translate(452,58)">
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
