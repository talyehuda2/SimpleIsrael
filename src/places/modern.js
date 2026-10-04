/* המפה המודרנית של מפת הארץ - אב טיפוס (אוקטובר 2026).

   בעל האתר ביקש מפה "כמו של ארץ קיר": ערים של היום, כבישים ורחובות, ומתג בין
   המפה העתיקה למודרנית. המפה של ארץ קיר עצמה מוגנת בזכויות יוצרים, ולכן זו
   מפה ממקורות פתוחים: OpenStreetMap דרך OpenFreeMap (חינם, בלי מפתח ובלי
   הרשמה), מוצגת ב-MapLibre.

   כמה החלטות שכדאי להכיר:
   - הקובץ הזה נטען רק כשעוברים למפה המודרנית (import דינמי ב-main.js).
     MapLibre שוקל מאות קילובייטים, ורוב המבקרים לא ילחצו על המתג.
   - ה-worker ותוסף ה-RTL מוגשים מ-/vendor/maplibre/ (ראו vite.config.js):
     ה-CSP חוסם worker מ-blob:, ובלי התוסף העברית במפה נכתבת הפוך.
   - המקומות המקראיים הם סמני HTML ולא שכבת טקסט של המפה: הגופן של הדפדפן
     מציג עברית נכון תמיד, בלי תלות בגופנים שהשרת החיצוני מגיש.
   - מקומות "מיקום מקורב" (מצרים, בבל...) לא מוצגים כאן. במפה העתיקה הנקודה
     שלהם מציינת כיוון בשולי הציור; במפה אמיתית היא הייתה נוחתת בנגב.
   - פרטיות: האריחים מגיעים מ-OpenFreeMap, שרואה איזה אזור נטען. לכן "איפה
     אני" במצב הזה מראה את הסיכה והרשימה, אבל אינו מזיז את המפה אל הגולש -
     אחרת האריחים שסביבו היו מסגירים לשרת החיצוני בערך איפה הוא. */
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

maplibregl.setWorkerUrl('/vendor/maplibre/maplibre-gl-worker.js');
let rtlRequested = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** האם הדפדפן מסוגל להציג את המפה (WebGL) */
export function supported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/* שמות בעברית: OpenStreetMap שומר שם מקומי ב-name ותרגומים ב-name:he.
   בישראל name הוא כבר עברית; מחוץ לה name:he מחליף "Amman" ב"עמאן". */
function hebrewLabels(map) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol' || !map.getLayoutProperty(layer.id, 'text-field')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:he'], ['get', 'name']]);
  }
}

/**
 * @param {HTMLElement} el      המכל של המפה
 * @param {object[]} places      places.json
 * @param {(id:string)=>void} onSelect
 * @param {(err:Error)=>void} onError
 */
export function createModern(el, { places, onSelect, onError }) {
  if (!rtlRequested) {
    rtlRequested = true;
    // lazy=true: התוסף נטען רק כשבאמת צריך לצייר טקסט מימין לשמאל
    maplibregl.setRTLTextPlugin('/vendor/maplibre/rtl-text.js', true).catch(() => {});
  }
  const shown = places.filter((p) => p.lat != null && !p.approx);
  /* מבט הבסיס הוא האחוזונים 10-90 של הביקורים, כמו במפה העתיקה: התחנות בסיני
     ובעבר הירדן המזרחי מותחות את התיבה, וארץ ישראל - שבה רוב הביקורים -
     יצאה זעירה באמצע המסך. */
  const q = (a, f) => { const t = [...a].sort((m, n) => m - n); return t[Math.floor((t.length - 1) * f)]; };
  const lats = [], lons = [];
  for (const p of shown) for (let i = 0; i < p.visits.length; i++) { lats.push(p.lat); lons.push(p.lon); }
  const bounds = new maplibregl.LngLatBounds([q(lons, .1), q(lats, .1)], [q(lons, .9), q(lats, .9)]);

  const map = new maplibregl.Map({
    container: el,
    style: STYLE_URL,
    bounds,
    fitBoundsOptions: { padding: 30 },
    maxBounds: [[31.5, 27.5], [38.5, 35.5]],   // ארץ ישראל וסביבתה, לא כל העולם
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.on('style.load', () => { try { hebrewLabels(map); } catch { /* סגנון שהשתנה - לא שוברים את המפה */ } });
  let failed = false;
  map.on('error', (e) => {
    // שגיאת אריח בודד אינה כישלון; סגנון שלא נטען - כן
    if (failed || map.isStyleLoaded()) return;
    failed = true;
    onError?.(e.error || new Error('style'));
  });

  // ---- סמני המקומות ----
  const RAD = (n) => 4 + 2.6 * Math.sqrt(n - 1);
  const markers = new Map();
  for (const p of shown) {
    const b = document.createElement('button');
    b.className = 'mm';
    b.dataset.id = p.id;
    b.dataset.v = p.visits.length;
    b.setAttribute('aria-label', `${p.name} - ${p.visits.length} ביקורים`);
    b.style.setProperty('--r', `${RAD(p.visits.length).toFixed(1)}px`);
    b.innerHTML = `<i class="mm-dot"></i><span class="mm-lb">${esc(p.name)}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); onSelect(p.id); });
    const m = new maplibregl.Marker({ element: b, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(map);
    markers.set(p.id, { m, b, p });
  }

  // שמות לפי זום, כמו במפה העתיקה: במבט רחוק רק המקומות הגדולים
  let sel = null;
  function paintLabels() {
    const z = map.getZoom();
    const need = z < 7.6 ? 6 : z < 8.4 ? 3 : z < 9.4 ? 2 : 1;
    for (const { b } of markers.values()) {
      // שמות "קרוב אליך" רק כשמתקרבים: במבט על כל הארץ חמישה שמות צפופים
      // נערמו זה על זה. הטבעת האדומה מסמנת אותם גם בלי שם.
      b.classList.toggle('lb-on', +b.dataset.v >= need || b.classList.contains('on') || (b.classList.contains('near') && z >= 9));
    }
  }
  map.on('zoomend', paintLabels);
  paintLabels();

  // ---- סיכת "אתה כאן" ----
  let pin = null;
  function setNear(near) {
    const nearIds = new Set(near && near.state === 'ok' ? near.list.map((n) => n.p.id) : []);
    for (const [id, { b }] of markers) b.classList.toggle('near', nearIds.has(id));
    if (near && near.state === 'ok') {
      if (!pin) {
        const pe = document.createElement('div');
        pe.className = 'mm-pin';
        pe.innerHTML = `<svg viewBox="-17 -46 34 50" width="34" height="50" aria-hidden="true">
          <ellipse cx="0" cy="0" rx="9" ry="3.5" fill="#000" fill-opacity=".28"/>
          <path d="M0,0 C-4,-10 -15,-18 -15,-29 A15,15 0 1 1 15,-29 C15,-18 4,-10 0,0 Z" fill="#d62828" stroke="#fff" stroke-width="2.5"/>
          <circle cx="0" cy="-29" r="6" fill="#fff"/></svg>`;
        pin = new maplibregl.Marker({ element: pe, anchor: 'bottom', offset: [0, 4] });
      }
      pin.setLngLat([near.lon, near.lat]).addTo(map);
    } else if (pin) pin.remove();
    paintLabels();
  }

  // ---- סינון ובחירה, מסונכרנים עם הרשימה של main.js ----
  function sync({ shownIds, selId }) {
    sel = selId;
    for (const [id, { b }] of markers) {
      b.classList.toggle('off', !shownIds.has(id));
      b.classList.toggle('on', id === sel);
    }
    document.body.classList.toggle('mm-has-sel', !!sel);
    paintLabels();
  }

  /* מצלמה. מקום נבחר: טיסה אליו. תקופה: כל המקומות שלה. אחרת: הארץ כולה.
     "איפה אני" אינו מזיז את המצלמה כאן - ראו את ההערה בראש הקובץ. */
  function focus({ selId, list }) {
    if (selId) {
      const hit = markers.get(selId);
      if (hit) map.flyTo({ center: [hit.p.lon, hit.p.lat], zoom: Math.max(map.getZoom(), 10.5), speed: 1.4 });
      return;
    }
    const pts = (list || []).filter((p) => markers.has(p.id));
    const bb = new maplibregl.LngLatBounds();
    if (!pts.length) return map.fitBounds(bounds, { padding: 30, duration: 600 });
    for (const p of pts) bb.extend([p.lon, p.lat]);
    map.fitBounds(bb, { padding: 40, maxZoom: 11, duration: 600 });
  }

  return {
    sync, focus, setNear,
    resize: () => map.resize(),
    destroy: () => map.remove(),
    get map() { return map; },
  };
}
