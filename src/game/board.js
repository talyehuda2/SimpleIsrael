/* טבלת המובילים, בלי supabase-js: קריאת REST אחת למפתח הציבורי. כך אורח
   רואה את הטבלה (והיא מה שמזמין להירשם) בלי להוריד את ספריית ההתחברות.
   לשחקן מחובר מעבירים את ה-JWT, ואז חוזר גם המקום שלו. */
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabaseConfig.js';

/* המפתח שתחתיו supabase-js שומר את ההתחברות. כאן ולא ב-account.js: לפיו
   מחליטים אם לטעון את account.js בכלל, ולכן הוא חייב להיות זמין בלעדיו */
export const AUTH_KEY = 'si_game_auth';

export async function fetchBoard(range, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/game_board`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_range: range }),
  });
  if (!r.ok) throw new Error(`game_board ${r.status}`);
  return r.json();
}
