// שיתוף קישור: תפריט השיתוף המקורי במכשירי מגע, ובדסקטופ העתקה ללוח
// (שם דיאלוג השיתוף של הדפדפן מגושם ולא עקבי).
// מחזיר את סוג התוצאה, כדי שהקורא יוכל להציג הודעה מתאימה.
export async function shareLink({ url, title }) {
  const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.share) {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch {
      return 'cancelled'; // המשתמש סגר את התפריט
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

// כתובת דף הפריט — היא זו שנושאת תמונת שיתוף ייחודית ותוכן שנקרא בלי JavaScript
export const itemPageUrl = (item) =>
  `${window.location.origin}/p/${item.kind}/${item.id}`;
