import { SUPABASE_URL, SUPABASE_KEY } from './supabaseConfig.js';

// שולף רק את עמודת target_key וסופר בצד הלקוח.
// שימוש ב-fetch רגיל (ולא ב-supabase-js) כדי לא לגרור את הספרייה לחבילה הראשית.
export async function fetchCommentCounts() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comments?select=target_key`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return {};
    const rows = await res.json();
    const counts = {};
    for (const r of rows) counts[r.target_key] = (counts[r.target_key] || 0) + 1;
    return counts;
  } catch {
    return {}; // בלי תגובות — פשוט לא מוצג מונה
  }
}
