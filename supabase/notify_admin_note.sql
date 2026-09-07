-- ============================================================================
--  התראה מסווגת על פנייה חדשה למנהל
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  הצורך: ההתראה הקודמת אמרה שיש פנייה, ולא מה יש בה. הפער אינו אורך
--  אלא סיווג - "זו בקשת הסרה, שעון 14 הימים התחיל" מול "זו הצעת תיקון
--  לתאריך". זה מה שקובע אם לעצור הכל או לקרוא בערב.
--
--  הזרימה, ולמה היא מפוצלת לשניים:
--
--    INSERT -> trg_notify_admin_note -> POST ל-/api/notify (Vercel)
--           -> Claude מסווג -> POST חזרה ל-push_admin_alert -> טלגרם
--
--  🔑 הסיבה לחזרה: **טוקן הטלגרם לא עוזב את Postgres.** אפשר היה
--  לתת ל-Vercel לדחוף ישירות, וזה היה חוסך קפיצה - אבל אז הטוקן היה
--  צריך לחיות כמשתנה סביבה ב-Vercel. הכלל הכי חשוב בפרויקט הוא שהטוקן
--  חי רק בגוף פונקציה כאן, וסיווג AI אינו סיבה מספיקה לשבור אותו.
--  לכן Vercel מסווג ומחזיר טקסט, ו-Postgres שולח.
--
--  ⚠️ שלושה מקומות שאתה ממלא בעצמך, מסומנים ב-<<< >>>.
--     שמור את העותק הממולא כ-notify_admin_note.local.sql - הסיומת
--     מכוסה ב-.gitignore.
--
--  את טוקן הטלגרם ומזהה הצ'אט אפשר לשלוף מהפונקציה הקיימת:
--    select prosrc from pg_proc where proname = 'notify_new_comment';
--
--  NOTIFY_SECRET הוא מחרוזת אקראית שאתה ממציא, והיא חייבת להיות זהה
--  כאן ובמשתני הסביבה של Vercel. לייצר אחת: select gen_random_uuid();
--
--  תלוי ב-contact_column.sql (העמודה contact) ובהרחבת pg_net.
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- ----------------------------------------------------------------------------
--  1. הדחיפה בפועל. נקראת מ-Vercel אחרי הסיווג.
--
--  security definer כדי שתוכל להחזיק את הטוקן; p_secret כדי שלא כל מי
--  שמכיר את הכתובת יוכל להציף לך את הטלפון. המפתח הציבורי של Supabase
--  מספיק כדי להגיע לכאן - מה שמגן זה הסוד, לא המפתח.
-- ----------------------------------------------------------------------------
create or replace function push_admin_alert(p_secret text, p_text text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text := '<<<NOTIFY_SECRET>>>';
  v_token  text := '<<<TELEGRAM_BOT_TOKEN>>>';
  v_chat   text := '<<<TELEGRAM_CHAT_ID>>>';
begin
  if p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'chat_id',                  v_chat,
      'text',                     p_text,
      'parse_mode',               'HTML',
      'disable_web_page_preview', true)
  );
end;
$$;

-- anon אכן מורשה לקרוא - זו הדרך שבה Vercel מגיע לכאן. ההגנה היא הסוד
-- שבגוף הפונקציה, ולכן אין כאן חשיפה של הטוקן לאף אחד.
grant execute on function push_admin_alert(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
--  2. הטריגר. שולח את הפנייה לסיווג.
-- ----------------------------------------------------------------------------
create or replace function notify_admin_note()
returns trigger
language plpgsql
security definer                 -- נדרש: contact נשללה מ-anon, והטריגר
set search_path = public, extensions   -- חייב לקרוא אותה כדי לצרף אותה
as $$
declare
  v_secret text := '<<<NOTIFY_SECRET>>>';
begin
  perform net.http_post(
    url     := 'https://simpleisrael.co.il/api/notify',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-notify-secret',  v_secret),
    body    := jsonb_build_object(
      'id',      new.id,
      'author',  new.author,
      'body',    new.body,
      'contact', new.contact)
  );
  return new;
exception when others then
  /* פנייה שנכתבה חייבת להישמר גם אם ההתראה נכשלה - ולכן בולעים. אבל
     בליעה שקטה משאירה אותך בלי עקבות כשלא מגיעה התראה, ולכן הכישלון
     נרשם. Supabase -> Logs -> Postgres, חיפוש notify_admin_note. */
  raise warning 'notify_admin_note failed: % / %', sqlstate, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_admin_note on comments;
create trigger trg_notify_admin_note
  after insert on comments
  for each row
  when (new.target_key = 'admin:notes')
  execute function notify_admin_note();

-- ----------------------------------------------------------------------------
--  ⚠️ שים לב לכפילות: אם notify_new_comment כבר שולחת התראה גם על
--  admin:notes, תקבל מעכשיו שתי הודעות על אותה פנייה. לבדוק:
--
--    select prosrc from pg_proc where proname = 'notify_new_comment';
--
--  אם היא לא מסננת לפי target_key - כלומר שולחת על כל שורה - אפשר
--  לצמצם אותה לתגובות ציבוריות בלבד בלי לגעת בגוף שלה, דרך תנאי
--  הטריגר. מצא את שם הטריגר שלה ואז:
--
--    drop trigger if exists <שם הטריגר> on comments;
--    create trigger <שם הטריגר>
--      after insert on comments
--      for each row
--      when (new.target_key is distinct from 'admin:notes')
--      execute function notify_new_comment();
--
--  בדיקה מקצה לקצה, בלי לחכות לגולש אמיתי:
--
--    insert into comments (target_key, target_label, author, body, contact)
--    values ('admin:notes', '📋 בדיקה', 'בדיקה',
--            'שלום, יש טעות בתאריך של שמואל הנביא', 'test@example.com');
--
--  ואז למחוק את השורה מ-/admin. אם לא הגיעה התראה:
--    select * from net._http_response order by created desc limit 5;
-- ----------------------------------------------------------------------------
