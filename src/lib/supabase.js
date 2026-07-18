import { createClient } from '@supabase/supabase-js';

// כתובת הפרויקט והמפתח הציבורי (publishable) — שניהם ציבוריים ובטוחים לשיבוץ באתר.
// ההגנה האמיתית היא ב-Row Level Security של Supabase, לא בהסתרת המפתח.
const SUPABASE_URL = 'https://qexatjrxbduysvmstfnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iKqGCqRI2s3qIdga5zq-tQ_2UL5rMzT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
