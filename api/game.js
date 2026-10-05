/* רישום ציון באתגר היומי של "סדר את הציר", לשחקן מחובר.

   למה בשרת: במשחק עצמו הדפדפן בודק את הסדר, ולכן ציון שהדפדפן היה כותב
   ישירות למסד היה פתוח לכל מי שפותח קונסול - וטבלת מובילים בלי אמון אינה
   שווה כלום. כאן הדפדפן שולח רק את הסדר שבחר. היד של היום מחושבת מאותו
   pool.js שהמשחק רץ עליו (אותו זרע, אותם נתונים, אותה פריסה), ולכן אין
   עותק שיכול להתיישן.

   הכתיבה: RPC game_record (supabase/game_accounts.sql) עם ה-JWT של השחקן,
   כך ש-auth.uid() הוא השחקן ולא אנחנו, ועם NOTIFY_SECRET - ההוכחה שהציון
   חושב כאן. אין SUPABASE_SERVICE_KEY: אותו דפוס של api/notify.js.

   משתני סביבה (Vercel בלבד): NOTIFY_SECRET - כבר מוגדר בשביל api/notify.js */
import { SUPABASE_URL, SUPABASE_KEY } from '../src/lib/supabaseConfig.js';
import { HAND, dailyAnswer, israelDay } from '../src/game/pool.js';
import { itemKey } from '../src/data/items.js';

// אתמול בשעון ישראל - בשביל מי שלחץ "בדיקה" שנייה לפני חצות
function yesterday(day) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST בלבד' });
  }
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    console.error('game: חסר NOTIFY_SECRET');
    return res.status(503).json({ error: 'השירות אינו זמין כרגע' });
  }
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }

  const { day, placed } = req.body || {};
  const today = israelDay();
  if (day !== today && day !== yesterday(today)) {
    return res.status(400).json({ error: 'האתגר הזה כבר נסגר' });
  }
  if (!Array.isArray(placed) || placed.length !== HAND || !placed.every((k) => typeof k === 'string')) {
    return res.status(400).json({ error: 'סדר לא תקין' });
  }

  // הסדר חייב להיות סידור של היד של אותו יום - בלי פריט זר ובלי כפילות
  const answer = dailyAnswer(day).map(itemKey);
  const want = new Set(answer);
  if (new Set(placed).size !== HAND || !placed.every((k) => want.has(k))) {
    return res.status(400).json({ error: 'הפריטים אינם של האתגר הזה' });
  }
  const score = placed.filter((k, i) => k === answer[i]).length;

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/game_record`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret, p_day: day, p_score: score, p_placed: placed }),
  });
  if (!r.ok) {
    const text = await r.text();
    // JWT שפג או שגוי: PostgREST מחזיר 401, והדפדפן ירענן את ההתחברות
    if (r.status === 401 || /JWT|התחברות/.test(text)) return res.status(401).json({ error: 'נדרשת התחברות' });
    console.error('game_record', r.status, text);
    return res.status(502).json({ error: 'השמירה נכשלה' });
  }
  return res.status(200).json(await r.json());
}
