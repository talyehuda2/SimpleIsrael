import { useState, useEffect } from 'react';
import maps from '../data/maps.json';

const KIND_COLOR = {
  leader: '#9c2b50', judge: '#8a5a2b', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

// חלון התצוגה — מיקוד באזור המרכז-צפון של הארץ
const VB = { x: 305, y: 45, w: 395, h: 500 };

const LAND = '#ecdcb4';
const SEA = '#a7c6ce';
const WATER = '#8bb0bd';

// קו החוף האמיתי של הים התיכון — נדגם מקו מתאר גיאוגרפי (mapsicon).
// כל היבשה בצבע אחיד כדי לכלול גם את הר אפרים/יהודה ועבר הירדן.
function BaseMap() {
  return (
    <g>
      {/* יבשה — רקע מלא */}
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill={LAND} />

      {/* הים הגדול (הים התיכון) — לאורך קו החוף האמיתי */}
      <path d="M305,45 L512,45 L510,120 L505,165 L500,205 L492,245 L483,280 L472,315 L460,345 L449,370 L440,392 L430,415 L418,437 L406,458 L396,478 L386,498 L378,520 L373,545 L305,545 Z"
        fill={SEA} stroke="#7c9aa0" strokeWidth="1.3" />
      <path d="M334,150 q10,-6 20,0 t20,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".5" />
      <path d="M326,262 q10,-6 20,0 t20,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".5" />
      <path d="M340,432 q10,-6 20,0 t20,0" fill="none" stroke="#8db0b6" strokeWidth="1.1" opacity=".5" />

      {/* אגם החולה */}
      <ellipse cx="612" cy="72" rx="6" ry="9" fill={WATER} stroke="#5f8792" strokeWidth="1" />
      {/* נהר הירדן — מהחולה דרך הכנרת אל ים המלח */}
      <path d="M612,81 C613,100 609,113 610,123" fill="none" stroke="#5b86a6" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M610,158 C618,250 596,352 585,420" fill="none" stroke="#5b86a6" strokeWidth="2.4" strokeLinecap="round" />
      {/* ים כנרת */}
      <ellipse cx="610" cy="140" rx="12" ry="18" fill={WATER} stroke="#5f8792" strokeWidth="1.2" />
      {/* ים המלח */}
      <ellipse cx="584" cy="476" rx="10" ry="56" fill={WATER} stroke="#5f8792" strokeWidth="1.2" />

      {/* תוויות אזורים */}
      <g className="map-region">
        <text x="520" y="110">הגליל</text>
        <text x="496" y="300">השומרון</text>
        <text x="452" y="462">יהודה</text>
        <text x="420" y="500">פלשת</text>
        <text x="672" y="250">הגלעד</text>
        <text x="338" y="326" className="map-sea">הים הגדול</text>
      </g>

      {/* מצפן */}
      <g transform="translate(676,82)">
        <circle r="15" fill="#fbf5e7" stroke="#b28a2b" strokeWidth="1.1" />
        <path d="M0,-13 L3.5,0 L0,13 L-3.5,0 Z" fill="#b28a2b" />
        <text x="0" y="-18" className="map-compass">צ</text>
      </g>
      {/* מסגרת זהב כפולה */}
      <rect x={VB.x + 3} y={VB.y + 3} width={VB.w - 6} height={VB.h - 6} fill="none" stroke="#b28a2b" strokeWidth="2.5" />
      <rect x={VB.x + 8} y={VB.y + 8} width={VB.w - 16} height={VB.h - 16} fill="none" stroke="#d8b755" strokeWidth="1" />
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
          <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="map-svg" preserveAspectRatio="xMidYMid meet">
            <BaseMap />
            {/* קו המסלול הכרונולוגי */}
            <polyline points={path} className="journey" />
            {/* סמנים ממוספרים */}
            {data.points.map((p) => (
              <g key={p.id} className={`marker ${active && active.id === p.id ? 'active' : ''}`}
                onClick={() => setActive(p)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="9" fill={color} stroke="#fff" strokeWidth="2" />
                <text x={p.x} y={p.y} dy=".33em" textAnchor="middle" className="marker-num">{p.order}</text>
              </g>
            ))}
          </svg>

          {active && (
            <div className="map-popup" style={{ left: `${((active.x - VB.x) / VB.w) * 100}%`, top: `${((active.y - VB.y) / VB.h) * 100}%` }}>
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
