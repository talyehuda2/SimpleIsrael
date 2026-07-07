import { useState, useEffect } from 'react';
import maps from '../data/maps.json';

const KIND_COLOR = {
  leader: '#9c2b50', judge: '#8a5a2b', united: '#6a3ca0', judah: '#245c93',
  israel: '#4f7a33', prophet: '#b3781a', book: '#157a70', event: '#b0392c',
};

// ממדי תמונת המפה (מוקטנת מ-1684x2528)
const IMG_W = 820;
const IMG_H = 1231;

// היטל אפיני lat/lon -> פיקסלים, שהותאם (least-squares) לערים המסומנות על המפה
const projX = (lon, lat) => 226.10 * lon + 21.00 * lat - 8226.5;
const projY = (lon, lat) => -38.05 * lon - 311.53 * lat + 11836.5;

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
  // dx/dy — היסט תצוגה קטן (יחידות ה-viewBox) להפרדת סמנים צפופים מדי
  const pts = data.points.map((p) => ({
    ...p,
    x: projX(p.lon, p.lat) + (p.dx || 0),
    y: projY(p.lon, p.lat) + (p.dy || 0),
  }));
  const path = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="map-overlay" onClick={onClose}>
      <aside className="map-panel" onClick={(e) => e.stopPropagation()}>
        <button className="map-close" onClick={onClose} aria-label="סגירה">✕</button>
        <h3 className="map-title">{data.title}</h3>
        <p className="map-sub">לחצו על נקודה במפה כדי לקרוא על מה שאירע בה</p>

        <div className="map-wrap">
          <svg viewBox={`0 0 ${IMG_W} ${IMG_H}`} className="map-svg" preserveAspectRatio="xMidYMid meet">
            <image href="/israel-map.jpg" x="0" y="0" width={IMG_W} height={IMG_H} />
            {/* קו המסלול הכרונולוגי */}
            <polyline points={path} className="journey" />
            {/* סמנים ממוספרים */}
            {pts.map((p) => (
              <g key={p.id} className={`marker ${active && active.id === p.id ? 'active' : ''}`}
                onClick={() => setActive(p)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r="16" fill={color} stroke="#fff" strokeWidth="3" />
                <text x={p.x} y={p.y} dy=".33em" textAnchor="middle" className="marker-num">{p.order}</text>
              </g>
            ))}
          </svg>

          {active && (
            <div className="map-popup" style={{ left: `${(active.x / IMG_W) * 100}%`, top: `${(active.y / IMG_H) * 100}%` }}>
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
