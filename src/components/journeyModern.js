/* המפה המודרנית של מפת המסע (אוקטובר 2026).

   אותו מסע של JourneyMap.jsx, על OpenStreetMap במקום על הציור: תחנות ממוספרות,
   קו המסלול, והמצלמה עפה מתחנה לתחנה. הבסיס (סגנון, עברית, סינון הגבולות,
   תבליט, CSP) משותף עם מפת הארץ - baseMap ב-places/modern.js.

   - נטען ב-import דינמי רק בלחיצה על המתג, כמו במפת הארץ: MapLibre כבד, ורוב
     המבקרים לא ילחצו.
   - JourneyMap נשאר מקור האמת לתחנה הפעילה; כאן רק מציירים ומדווחים על לחיצה.
   - מקומות "מחוץ למפה" (מצרים, בבל, חרן...) מוצגים כאן במקומם האמיתי (שלב 2):
     journeyStations נותן להם lat/lon מ-offMapReal, ולא את נקודת השוליים של
     הציור. לכן גם המסגרת רחבה מזו של מפת הארץ - מאור כשדים ושושן במזרח
     ועד נוף שבמצרים. כאן נראה הדבר שהציור לא יכול להראות: המרחקים האמיתיים.
     */
import * as maplibregl from 'maplibre-gl';
import { baseMap, supported } from '../places/modern.js';
import './JourneyModern.css';

export { supported };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROUTE_GOLD = '#b28a2b';
// זום של "טיסה" לתחנה: כמו ההתקרבות של המפה המצוירת (ZOOM=2.1). ב-9.4 עין גדי
// מילאה את החלון ולא נראה דבר סביבה
const STATION_ZOOM = 8.4;
const empty = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } };
const line = (pts) => ({ ...empty, geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lon, p.lat]) } });

/**
 * @param {HTMLElement} el
 * @param {{ onPick:(i:number)=>void, onError:(e:Error)=>void, onPos:(pos:{x:number,y:number}|null)=>void }} opts
 */
export function createJourneyModern(el, { onPick, onError, onPos }) {
  let stations = [], color = ROUTE_GOLD, step = -1, markers = [];
  const shown = () => stations.filter((p) => p.lat != null);

  // מסגרת רחבה: המסעות מגיעים עד שושן במזרח, חרן בצפון ונוף שבמצרים במערב
  const map = baseMap(el, { bounds: [[34.2, 29.6], [36, 33.3]], padding: 20, onError,
    maxBounds: [[24, 22], [54, 41]] });

  // המסלול: קו מקווקו לכל האורך, וקו מלא בצבע הדמות עד התחנה הפעילה - כמו בציור
  function addRoute() {
    if (map.getSource('si-route')) return;
    map.addSource('si-route', { type: 'geojson', data: empty });
    map.addSource('si-progress', { type: 'geojson', data: empty });
    map.addLayer({ id: 'si-route', type: 'line', source: 'si-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROUTE_GOLD, 'line-width': 3.5, 'line-dasharray': [2, 2.2], 'line-opacity': 0.85 } });
    map.addLayer({ id: 'si-progress', type: 'line', source: 'si-progress',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': 4 } });
    paintRoute();
  }
  // style.load ולא load: אם הסגנון נטען מחדש, שכבות שהוספנו נמחקות איתו
  map.on('style.load', addRoute);

  /* קו ההתקדמות נמתח מהתחנה הקודמת לחדשה, כמו בציור (שם stroke-dashoffset עם
     transition). כאן אין CSS לקו של המפה, ולכן מחשבים את הקו החלקי בכל פריים:
     prog הוא המרחק לאורך המסלול, ונע אל המרחק של התחנה הפעילה. המרחק בקירוב
     שטוח (קו אורך כפול קוסינוס הרוחב) - מספיק לחלוקה הוגנת בין קטעים. */
  let cum = [], prog = 0, progAF = 0, progTO = 0;
  function measure() {
    const pts = shown();
    cum = pts.map(() => 0);
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1], b = pts[k];
      const dx = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180), dy = b.lat - a.lat;
      cum[k] = cum[k - 1] + Math.hypot(dx, dy);
    }
  }
  // המרחק לאורך המסלול של התחנה הפעילה (או של האחרונה לפניה שיש לה מיקום)
  function targetProg() {
    if (step < 0) return 0;
    const pts = shown();
    let k = -1;
    for (let j = 0; j <= step && j < stations.length; j++) if (stations[j].lat != null) k = pts.indexOf(stations[j]);
    return k < 0 ? 0 : cum[k];
  }
  function progLine(v) {
    const pts = shown();
    if (v <= 0 || pts.length < 2) return line([]);
    const out = [pts[0]];
    for (let k = 1; k < pts.length; k++) {
      if (cum[k] <= v) { out.push(pts[k]); continue; }
      const t = (v - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
      const a = pts[k - 1], b = pts[k];
      out.push({ lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t });
      break;
    }
    return line(out);
  }
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animateProg() {
    cancelAnimationFrame(progAF); clearTimeout(progTO);
    const from = prog, to = targetProg(), t0 = performance.now(), D = 900;
    const set = (v) => { prog = v; map.getSource('si-progress')?.setData(progLine(v)); };
    if (still() || from === to) return set(to);
    const tick = (now) => {
      const e = Math.min(1, (now - t0) / D);
      set(from + (to - from) * (1 - Math.pow(1 - e, 3)));   // easeOutCubic, כמו בציור
      if (e < 1) progAF = requestAnimationFrame(tick);
    };
    progAF = requestAnimationFrame(tick);
    // רשת ביטחון: בלשונית ברקע rAF אינו רץ, והקו היה נתקע באמצע
    progTO = setTimeout(() => { cancelAnimationFrame(progAF); set(to); }, D + 150);
  }

  function paintRoute() {
    if (!map.getSource('si-route')) return;
    map.getSource('si-route').setData(line(shown()));
    map.getSource('si-progress').setData(progLine(prog));
    map.setPaintProperty('si-progress', 'line-color', color);
    map.setPaintProperty('si-route', 'line-opacity', step < 0 ? 0.85 : 0.45);
  }

  /* טבעת הספירה סביב התחנה הפעילה, כמו בציור: מתרוקנת לאורך זמן השהייה ומראה
     כמה נשאר עד הקפיצה הבאה; קופאת בהשהיה. נבנית מחדש בכל תחנה, כדי שהאנימציה
     תתחיל מההתחלה. */
  const RING_C = 2 * Math.PI * 17;
  let timer = { on: false, playing: false, ms: 8000 }, ringStep = null;
  function paintTimer() {
    const mk = markers.find((x) => x.i === step);
    const old = el.querySelector('.jmm-ring');
    if (!timer.on || !mk) { old?.remove(); ringStep = null; return; }
    if (!old || ringStep !== step || old.parentNode !== mk.b) {
      old?.remove();
      mk.b.insertAdjacentHTML('beforeend', `<svg class="jmm-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle class="jmm-ring-t" cx="20" cy="20" r="17"/>
        <circle class="jmm-ring-a" cx="20" cy="20" r="17" transform="rotate(-90 20 20)"
          style="stroke-dasharray:${RING_C.toFixed(1)};--ring-c:${RING_C.toFixed(1)};animation-duration:${timer.ms}ms"/></svg>`);
      ringStep = step;
    }
    el.querySelector('.jmm-ring-a').style.animationPlayState = timer.playing ? 'running' : 'paused';
  }

  function paintMarkers() {
    markers.forEach(({ b, i }) => {
      b.classList.toggle('active', i === step);
      b.classList.toggle('future', step >= 0 && i > step);
    });
  }

  /* תחנות צפופות: במבט-העל של אברהם (מאור כשדים ועד מצרים) שש התחנות בכנען
     נערמו זו על זו לגוש אחד של מספרים. סמן שנופל קרוב מדי לסמן שכבר הוצג
     מתכווץ לנקודה קטנה בלי מספר (tiny); כשמתקרבים הם נפרדים והמספרים חוזרים.
     התחנה הפעילה תמיד במלואה, ונבדקת ראשונה. */
  const NEAR_PX = 20;
  let dcFrame = 0;
  function declutter() {
    dcFrame = 0;
    const order = [...markers].sort((a, b) => (b.i === step) - (a.i === step) || a.i - b.i);
    const kept = [];
    for (const mk of order) {
      const pt = map.project(mk.m.getLngLat());
      const crowded = mk.i !== step && kept.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < NEAR_PX);
      mk.b.classList.toggle('tiny', crowded);
      if (!crowded) kept.push(pt);
    }
  }
  const queueDeclutter = () => { if (!dcFrame) dcFrame = requestAnimationFrame(declutter); };
  map.on('move', queueDeclutter);

  function report() {
    const p = stations[step];
    if (!onPos) return;
    if (!p || p.lat == null) return onPos(null);
    const pt = map.project([p.lon, p.lat]);
    onPos({ x: pt.x, y: pt.y });
  }
  map.on('move', report);

  function fitAll(animate) {
    const pts = shown();
    if (!pts.length) return;
    const bb = new maplibregl.LngLatBounds();
    for (const p of pts) bb.extend([p.lon, p.lat]);
    map.fitBounds(bb, { padding: 50, maxZoom: 9.5, duration: animate ? 700 : 0 });
  }

  return {
    /** מסע חדש: תחנות (journeyStations, עם lat/lon) וצבע הדמות */
    setJourney(list, c) {
      stations = list; color = c || ROUTE_GOLD; step = -1;
      markers.forEach(({ m }) => m.remove());
      markers = [];
      stations.forEach((p, i) => {
        if (p.lat == null) return;
        const b = document.createElement('button');
        b.className = 'jmm';
        b.style.setProperty('--c', color);
        b.setAttribute('aria-label', `${p.order}. ${p.name}`);
        b.innerHTML = `<span class="jmm-n">${esc(p.order)}</span>`;
        b.addEventListener('click', (e) => { e.stopPropagation(); onPick(i); });
        const m = new maplibregl.Marker({ element: b, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(map);
        markers.push({ m, b, i });
      });
      measure(); prog = 0; cancelAnimationFrame(progAF); clearTimeout(progTO);
      paintRoute(); paintMarkers(); fitAll(false); report(); queueDeclutter(); paintTimer();
    },
    /** -1 = מבט-על; אחרת אינדקס התחנה ב-stations */
    setStep(i) {
      step = i;
      paintRoute(); paintMarkers(); animateProg(); paintTimer();
      const p = stations[step];
      if (step < 0 || !p || p.lat == null) fitAll(true);
      else map.flyTo({ center: [p.lon, p.lat], zoom: STATION_ZOOM, speed: 1.3 });
      report(); queueDeclutter();
    },
    /** טבעת הספירה: on = מוצגת, playing = רצה (אחרת קפואה), ms = משך השהייה בתחנה */
    setTimer(t) { timer = { ...timer, ...t }; paintTimer(); },
    resize: () => { map.resize(); report(); queueDeclutter(); },
    destroy: () => { cancelAnimationFrame(progAF); clearTimeout(progTO); map.remove(); },
  };
}
