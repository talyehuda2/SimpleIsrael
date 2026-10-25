/* ההתראה היומית: "דמות היום" לכל המנויים, בשעה שכל אחד בחר. מופעל מ-Cron של Vercel
   (vercel.json) בכל שעה שאפשר לבחור - 8:00, 13:00, 17:00 ו-21:00 (SLOTS ב-src/lib/holy.js,
   בעל האתר, אוקטובר 2026; עד אז 21:00 לכולם). ה-Cron הוא UTC ואינו יודע על שעון קיץ,
   ולכן כל שעה מופעלת פעמיים, ושולחת רק בהפעלה שבה השעה בישראל מתאימה (slotUpTo).

   כל הפעלה שולחת למי שבחר בשעה שלה *או קודם* ועוד לא קיבל היום: מי שבחר 8:00 ונפל
   על שבת מקבל במוצאי שבת ב-21:00. בערב שבת וחג ההפעלה של 13:00 שולחת לכולם - אחריה
   כבר אסור (src/lib/holy.js: לעולם לא בשבת ובחג). הבדיקה כאן, בכל הפעלה, ולא רק
   בשעות ה-Cron: הפעלה באיחור או ידנית לא תשלח בשבת.

   רק למי שהתדירות שלו "בתור" היום (כל יום / יום כן יום לא / פעמיים / פעם בשבוע).

   תזכורת למשחק (supabase/push_game.sql, אוקטובר 2026): מי שביקש אותה ועוד לא פתר את
   האתגר היומי מקבל אותה *במקום* דמות היום - התראה אחת לערב, לא שתיים באותה דקה. מי
   שכבר שיחק (הדפדפן מסמן ב-push_game_played) מקבל את דמות היום, אם התדירות שלו בתור.

   מה נשלח: הפריט של היום מ-src/lib/daily.js - זהה לכולם; בשישי מפרשת השבוע,
   ובחג מהחג, ואז שורת "למה" מעל - עם משפט או שניים מהתיאור, תמונת השיתוף שלו, וקישור לכרטיס בציר הזמן עם src=push (כך במסך
   הניהול רואים כמה נכנסו מההתראה).

   אין כאן בדיקת הרשאה, ובכוונה: push_claim מסמנת כל מנוי לפני השליחה, ולכן
   הפעלה נוספת באותו יום - של ה-Cron או של מישהו שמצא את הכתובת - לא שולחת
   כלום. מנוי ששירות ההתראות אמר שבוטל (404/410) נמחק. */
import { vapid, rpc, send, secret, SITE } from './_lib/push.js';
import { dailyPick, teaser } from '../src/lib/daily.js';
import { israelDay, dayNumber } from '../src/game/pool.js';
import { freqsDue, slotUpTo } from '../src/lib/holy.js';

const BATCH = 500;

/* push_claim_slot (supabase/push_time.sql) - לפי השעה שכל אחד בחר, ועם התזכורת למשחק.
   עד שהקובץ רץ אין בחירת שעה, וכולם מקבלים כמו קודם - ב-21:00 ובשישי בצהריים - דרך
   push_claim_evening (push_game.sql), push_claim_due (push_freq.sql) או push_claim */
const missing = (e) => /PGRST202| 404 /.test(e.message);
async function claim(day, due, upTo) {
  const args = { p_secret: secret(), p_day: day, p_limit: BATCH };
  try {
    return await rpc('push_claim_slot', { ...args, p_freqs: due, p_hour: upTo });
  } catch (e) {
    if (!missing(e)) throw e;
  }
  if (upTo < 21) return [];
  for (const [name, extra] of [['push_claim_evening', { p_freqs: due }], ['push_claim_due', { p_freqs: due }], ['push_claim', {}]]) {
    try {
      return await rpc(name, { ...args, ...extra });
    } catch (e) {
      if (!missing(e)) throw e;
    }
  }
  return [];
}

export default async function handler(req, res) {
  if (!secret()) return res.status(503).json({ error: 'חסר NOTIFY_SECRET' });
  const upTo = slotUpTo();
  if (upTo === null) return res.status(200).json({ skipped: 'לא שעת שליחה (או שבת וחג) - ההפעלה השנייה של השעה תשלח' });
  const day = israelDay();
  const due = freqsDue(day);
  const { it, title, why } = dailyPick(day);
  const payload = {
    title,
    body: why ? `${why}\n${teaser(it.description, 100)}` : teaser(it.description),
    url: `/?sel=${it.kind}:${it.id}&src=push`,
    image: `${SITE}/og/${it.kind}/${it.id}.jpg`,
    tag: 'si-daily',
  };
  const game = {
    title: `🎯 אתגר #${dayNumber(day)} מחכה לכם`,
    body: 'חמישה פריטים - מי קודם למי? דקה אחת, וכל יום יד חדשה.',
    url: '/game?src=push-game',
    image: `${SITE}/og/game.jpg`,
    tag: 'si-game',
  };
  try {
    await vapid();
    let sent = 0, gone = 0, failed = 0, games = 0;
    // סבבים של 500 עד שהתור של היום ריק. מנוי שסומן ונכשל (תקלה זמנית בשירות
    // ההתראות) מפספס את היום הזה - עדיף על פני סיכון לשלוח לאחרים פעמיים
    for (let round = 0; round < 20; round++) {
      const subs = await claim(day, due, upTo);
      if (!subs?.length) break;
      const results = [];
      for (let i = 0; i < subs.length; i += 25) {
        results.push(...await Promise.all(subs.slice(i, i + 25).map((s) => send(s, s.game_due ? game : payload))));
      }
      const dead = subs.filter((_, i) => results[i] === 'gone').map((s) => s.endpoint);
      if (dead.length) await rpc('push_gone', { p_secret: secret(), p_endpoints: dead });
      sent += results.filter((r) => r === 'ok').length;
      games += subs.filter((x, i) => x.game_due && results[i] === 'ok').length;
      gone += dead.length;
      failed += results.filter((r) => r === 'fail').length;
      if (subs.length < BATCH) break;
    }
    console.log('push-daily', day, upTo, it.kind, it.id, due, { sent, games, gone, failed });
    return res.status(200).json({ day, upTo, item: `${it.kind}:${it.id}`, due, sent, games, gone, failed });
  } catch (e) {
    console.error('push-daily', e.message);
    return res.status(502).json({ error: 'שגיאה זמנית' });
  }
}
