/* "דף להורדה" - עמוד A4 על דמות (scripts/sheet-html.mjs). מקור אחד לשאלה למי יש
   דף, לבנייה (prerender) ולכפתור בכרטיס. דמויות בלבד: לספר, לאירוע ולמלכות אין
   "דמויות מתקופתו" ו"נביאים בימיו" במובן הזה. */
export const SHEET_KINDS = new Set(['leader', 'judge', 'united', 'judah', 'israel', 'prophet', 'world']);
export const hasSheet = (item) => !!item && SHEET_KINDS.has(item.kind);
export const sheetPath = (item) => `/p/${item.kind}/${item.id}/sheet`;
