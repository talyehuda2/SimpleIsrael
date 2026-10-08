/* המפה המודרנית של מפת הארץ (אוקטובר 2026).

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
   - מקומות "מחוץ למפה" (מצרים, בבל...) לא מוצגים כאן. במפה העתיקה הנקודה
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
    if (layer.type !== 'symbol') continue;
    const tf = map.getLayoutProperty(layer.id, 'text-field');
    // רק שכבות שמציגות שם. מגיני הכבישים מציגים את מספר הכביש (ref), ובגרסה
    // הראשונה גם הם קיבלו "שם" - וכל מגן הפך למלבן לבן ריק.
    if (!tf || !JSON.stringify(tf).includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:he'], ['get', 'name']]);
  }
}

/* בלי גבולות מדיניים ושמות מדינות: זו מפה של אתרים מקראיים, והקווים
   והתוויות של היום (גבולות, "השטחים הפלסטיניים", שמות מדינות) אינם חלק
   מהשאלה שהיא עונה עליה - רק מוסיפים רעש ומחלוקת. הערים, הכבישים והנוף
   נשארים. ההחלטה של בעל האתר, וקל להחזיר: למחוק את הקריאה. */
const HIDE = /^(boundary_|label_country_|label_state$)/;
/* בהחלטת בעל האתר: שום אזכור של פלסטין על המפה. מעבר להסתרת הגבולות
   ושמות המדינות, כל תווית (מקום, אזור, מבנה, דרך) ששמה מזכיר את המילה -
   בעברית, באנגלית או בערבית, בכל אחד משדות השם - מסוננת בכל שכבות הטקסט. */
const BANNED = ['פלסטינ', 'פלשתינ', 'Palestin', 'palestin', 'فلسطين'];
const ALL_NAMES = ['concat', ...['name', 'name:he', 'name:en', 'name:latin', 'name:nonlatin', 'name:ar', 'name_en', 'name_int']
  .flatMap((k) => [['coalesce', ['get', k], ''], ' '])];
const NOT_BANNED = ['all', ...BANNED.map((w) => ['!', ['in', w, ALL_NAMES]])];
function hidePolitics(map) {
  for (const layer of map.getStyle().layers) {
    if (HIDE.test(layer.id)) { map.setLayoutProperty(layer.id, 'visibility', 'none'); continue; }
    if (layer.type !== 'symbol') continue;
    const f = map.getFilter(layer.id);
    try {
      map.setFilter(layer.id, f ? ['all', f, NOT_BANNED] : NOT_BANNED);
    } catch {
      // מסנן בתחביר הישן שאי אפשר לשלב - השכבה כולה יורדת, כדי לא להשאיר פרצה
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

/* תבליט בסגנון מפת קיר: צבע לפי גובה (ירוק בשפלה ובבקעה, צהוב-חום בהרים)
   והצללה מצפון-מערב, כך שהרי יהודה, הכרמל והגלבוע בולטים כמו על הקיר.
   הגבהים הם Terrain Tiles הפתוחים של AWS (קידוד terrarium, כולל מתחת לפני
   הים - ים המלח יורד ל-430 מטר מתחת). השכבות נכנסות מתחת לפארקים, לכבישים
   ולשמות, וכיסויי הקרקע של הסגנון מתעמעמים כדי שהתבליט ייראה דרכם. */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
function addRelief(map) {
  if (map.getSource('dem')) return;
  map.addSource('dem', {
    type: 'raster-dem', tiles: [DEM_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 12,
    // באנגלית: מילה עברית בתוך שורת הקרדיטים האנגלית התהפכה לקצה השני
    attribution: 'Terrain: Mapzen / AWS',
  });
  const before = map.getLayer('park') ? 'park' : undefined;
  map.addLayer({
    id: 'si-relief', type: 'color-relief', source: 'dem',
    paint: {
      'color-relief-opacity': 0.9,
      'color-relief-color': ['interpolate', ['linear'], ['elevation'],
        -450, '#7fb383', 0, '#a9d39a', 150, '#cfe1a0', 400, '#ebe2a6',
        700, '#e2c584', 1000, '#c9a06c', 1400, '#ad8259', 2200, '#8f6e57'],
    },
  }, before);
  map.addLayer({
    id: 'si-hillshade', type: 'hillshade', source: 'dem',
    paint: {
      'hillshade-exaggeration': 0.55,
      'hillshade-illumination-direction': 315,
      'hillshade-shadow-color': '#4a3824',
      'hillshade-highlight-color': '#fffbea',
      'hillshade-accent-color': '#6b5233',
    },
  }, before);
  // הצל של Natural Earth (רסטר גס לזום רחוק) מיותר כשיש תבליט אמיתי
  if (map.getLayer('natural_earth')) map.setLayoutProperty('natural_earth', 'visibility', 'none');
  // כיסויי הקרקע שקופים יותר, וחול הנגב יורד - הוא כיסה את התבליט במלבן צהוב אחיד
  for (const [id, prop, v] of [['park', 'fill-opacity', 0.35], ['landcover_wood', 'fill-opacity', 0.35],
    ['landcover_grass', 'fill-opacity', 0.3], ['landuse_residential', 'fill-opacity', 0.55]]) {
    if (map.getLayer(id)) map.setPaintProperty(id, prop, v);
  }
  if (map.getLayer('landcover_sand')) map.setLayoutProperty('landcover_sand', 'visibility', 'none');
}

/** בסיס משותף למפה המודרנית של מפת הארץ ושל מפת המסע (journeyModern.js):
    הסגנון, העברית, סינון הגבולות וה"פלסטין", התבליט, שורת הקרדיטים וזיהוי
    כישלון. כל מה שמעבר לזה - סמנים, קווים ומצלמה - שייך למי שקורא לה. */
export function baseMap(el, { bounds, padding = 30, onError, maxBounds = [[31.5, 27.5], [38.5, 35.5]] }) {
  if (!rtlRequested) {
    rtlRequested = true;
    // lazy=true: התוסף נטען רק כשבאמת צריך לצייר טקסט מימין לשמאל
    maplibregl.setRTLTextPlugin('/vendor/maplibre/rtl-text.js', true).catch(() => {});
  }
  const map = new maplibregl.Map({
    container: el,
    style: STYLE_URL,
    bounds,
    fitBoundsOptions: { padding },
    maxBounds,   // ברירת המחדל: ארץ ישראל וסביבתה, לא כל העולם
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  /* שורת הקרדיטים נפתחת מורחבת, ובטלפון כיסתה את תחתית המפה. MapLibre פותח
     אותה מחדש בכל פעם שמקור חדש (הגבהים) מוסיף קרדיט - ולכן סוגרים בכל
     sourcedata, עד שהגולש לוחץ בעצמו על ⓘ. */
  let attribTouched = false;
  const collapseAttrib = () => {
    if (!attribTouched) el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  };
  map.on('load', collapseAttrib);
  map.on('sourcedata', collapseAttrib);
  el.addEventListener('click', (e) => { if (e.target.closest?.('.maplibregl-ctrl-attrib-button')) attribTouched = true; }, true);
  // לאבחון בלבד: ?mapdebug חושף את המפה ואת השגיאות שלה לקונסולה
  if (window.__siDebug || new URLSearchParams(location.search).has('mapdebug')) {
    window.__siMap = map;
    map.on('error', (e) => console.warn('maplibre:', e.error?.message || e));
  }
  map.on('style.load', () => {
    try { hebrewLabels(map); hidePolitics(map); } catch { /* סגנון שהשתנה - לא שוברים את המפה */ }
    try { addRelief(map); } catch { /* בלי תבליט המפה עדיין עובדת */ }
  });
  let failed = false;
  map.on('error', (e) => {
    // רק קובץ הסגנון עצמו הוא כישלון. אריח, sprite או גופן שנכשלו (רשת חלשה)
    // אינם - בגרסה הראשונה sprite אחד שנכשל החזיר את כל המפה ל"עתיקה".
    if (failed || map.isStyleLoaded() || (e.error?.url && e.error.url !== STYLE_URL)) return;
    failed = true;
    onError?.(e.error || new Error('style'));
  });
  return map;
}

/**
 * @param {HTMLElement} el      המכל של המפה
 * @param {object[]} places      places.json
 * @param {(id:string)=>void} onSelect
 * @param {(err:Error)=>void} onError
 */
export function createModern(el, { places, onSelect, onError, initialBounds }) {
  const shown = places.filter((p) => p.lat != null && !p.approx);
  /* מבט הבסיס הוא האחוזונים 10-90 של הביקורים, כמו במפה העתיקה: התחנות בסיני
     ובעבר הירדן המזרחי מותחות את התיבה, וארץ ישראל - שבה רוב הביקורים -
     יצאה זעירה באמצע המסך. */
  const q = (a, f) => { const t = [...a].sort((m, n) => m - n); return t[Math.floor((t.length - 1) * f)]; };
  const lats = [], lons = [];
  for (const p of shown) for (let i = 0; i < p.visits.length; i++) { lats.push(p.lat); lons.push(p.lon); }
  const bounds = new maplibregl.LngLatBounds([q(lons, .1), q(lats, .1)], [q(lons, .9), q(lats, .9)]);

  // מבט פתיחה: האזור שהיה על המסך במפה העתיקה, אם נמסר; אחרת מבט הבסיס
  const map = baseMap(el, { bounds: initialBounds || bounds, padding: initialBounds ? 0 : 30, onError });

  // ---- סמני המקומות ----
  // קטנים מהעתיקה: כאן מתחתם מפה אמיתית, ועיגולים בגודל של שם עיר כיסו אותה
  const RAD = (n) => 3.5 + 1.5 * Math.sqrt(n - 1);
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
    /** [[מערב, דרום], [מזרח, צפון]] של מה שעל המסך */
    getView: () => { const b = map.getBounds(); return [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]]; },
    setView: (bb) => map.fitBounds(bb, { padding: 0, animate: false }),
    resize: () => map.resize(),
    destroy: () => map.remove(),
    get map() { return map; },
  };
}
