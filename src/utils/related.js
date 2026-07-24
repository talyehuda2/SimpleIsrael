// "אולי יעניין אותך גם" — קשרים שאינם כרונולוגיים-רצופים:
// (1) מאותה תקופה, (2) אותו מקום גיאוגרפי. לוגיקה משותפת לאפליקציה ול-prerender.

const ovl = (a, b) => {
  if (a.start === a.end) return a.start >= b.start && a.start <= b.end;
  if (b.start === b.end) return b.start >= a.start && b.start <= a.end;
  return a.start < b.end && a.end > b.start;
};

// התקופה שבה הפריט מתחיל
export function periodOfItem(item, periods) {
  return periods.find((p) => item.start >= p.start && item.start < p.end)
    || periods.find((p) => item.start >= p.start && item.start <= p.end)
    || null;
}

// פריטים מאותה תקופה, פרט לאלה שכבר מוצגים (excludeKeys = Set של "kind:id").
// ממוינים לפי קרבה בזמן לפריט, ומוגבלים ל-limit.
export function relatedByEra(item, allItems, periods, excludeKeys = new Set(), limit = 6) {
  const era = periodOfItem(item, periods);
  if (!era) return [];
  const mid = (item.start + item.end) / 2;
  return allItems
    .filter((x) =>
      !(x.kind === item.kind && x.id === item.id)
      && !excludeKeys.has(`${x.kind}:${x.id}`)
      && x.start < era.end && x.end > era.start)
    .sort((a, b) => Math.abs((a.start + a.end) / 2 - mid) - Math.abs((b.start + b.end) / 2 - mid))
    .slice(0, limit);
}

// אינדקס מקומות: תא-קואורדינטה (0.1°) → קבוצת דמויות; ולכל דמות שם-המקום שלה בתא.
export function buildPlaceIndex(maps) {
  const cellFigs = {};
  const figCellName = {};
  const key = (lat, lon) => `${Math.round(lat * 10)}_${Math.round(lon * 10)}`;
  for (const [fid, data] of Object.entries(maps)) {
    if (fid === '_proj') continue;
    const pts = Array.isArray(data) ? data : (data.points || []);
    figCellName[fid] = {};
    for (const p of pts) {
      if (p.lat == null || p.lon == null) continue; // תחנות off-map (x/y) אינן משתתפות
      const k = key(p.lat, p.lon);
      (cellFigs[k] ||= new Set()).add(fid);
      if (!figCellName[fid][k]) figCellName[fid][k] = p.name;
    }
  }
  return { cellFigs, figCellName };
}

// דמויות שחולקות מקום ייחודי עם הפריט. מדלגים על מקומות גנריים (ירושלים וכו')
// המשותפים ליותר מ-maxShare דמויות. מדרגים לפי נדירות המקום (נדיר = קשר חזק יותר).
export function relatedByPlace(itemId, index, resolveById, { maxShare = 10, limit = 5 } = {}) {
  const mine = index.figCellName[itemId];
  if (!mine) return [];
  const best = {};
  for (const [cell, placeName] of Object.entries(mine)) {
    const figs = index.cellFigs[cell];
    if (!figs || figs.size > maxShare) continue;
    for (const fid of figs) {
      if (fid === itemId) continue;
      if (!best[fid] || figs.size < best[fid].rarity) best[fid] = { place: placeName, rarity: figs.size };
    }
  }
  return Object.entries(best)
    .map(([fid, info]) => {
      const it = resolveById(fid);
      return it ? { ...it, place: info.place, rarity: info.rarity } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.rarity - b.rarity)
    .slice(0, limit);
}

export { ovl };
