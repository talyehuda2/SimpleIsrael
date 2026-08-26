-- ============================================================================
--  מייל למגיב כשמישהו עונה לו
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  זו החלופה להרשמה עם גוגל. הצורך היה "שיקבל מייל אם יגיבו לו", וזה לא
--  דורש חשבונות, OAuth, ניהול משתמשים ומחיקת חשבון - אלא עמודה אחת
--  וטריגר. המשתמש מקליד כתובת (או שהדפדפן משלים לו) ומסיים.
--
--  ⚠️ יש כאן שני מקומות שאתה ממלא בעצמך, מסומנים ב-<<< >>>.
--     המפתח לא נכתב בקוד האתר ולא נשלח בצ'אט - רק כאן, בגוף הפונקציה,
--     בדיוק כמו ב-notify_new_comment הקיימת.
--     לראות איך הפונקציה הקיימת קוראת ל-Resend (ולוודא שאותו סגנון):
--       select prosrc from pg_proc where proname = 'notify_new_comment';
-- ============================================================================

alter table comments add column if not exists notify_email text;

-- אותה הגנה כמו בעמודת contact: אנונימי כותב, ולעולם לא קורא. בלי זה
-- כל מבקר היה יכול לשלוף את כתובות המייל של כל מי שהגיב אי פעם.
revoke select (notify_email) on comments from anon;
revoke select (notify_email) on comments from authenticated;

-- ----------------------------------------------------------------------------
create or replace function notify_comment_reply()
returns trigger
language plpgsql
security definer                 -- נדרש: בלעדיו הטריגר רץ כ-anon ולא יוכל
set search_path = public, extensions   -- לקרוא את notify_email שנשלל ממנו
as $$
declare
  v_to   text;
  v_name text;
  v_url  text;
  v_body text;
  v_who  text;
  v_key  constant text := '<<< כאן מדביקים את מפתח ה-API של Resend >>>';
  v_from constant text := '<<< כאן מדביקים את כתובת השולח, למשל: ציר הזמן <noreply@simpleisrael.co.il> >>>';
begin
  -- רק תשובות בתוך שרשור מעניינות כאן
  if new.parent_id is null then return new; end if;

  select notify_email, coalesce(author, 'שלום')
    into v_to, v_name
    from comments where id = new.parent_id;

  if v_to is null or btrim(v_to) = '' then return new; end if;
  -- בדיקת צורה בסיסית, כדי לא לשרוף קריאות על כתובות שגויות
  if v_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return new; end if;

  -- תוכן שנכתב בידי גולשים נכנס לתוך HTML, ולכן חייב בריחה
  v_body := replace(replace(new.body,   '<', '&lt;'), '>', '&gt;');
  v_who  := replace(replace(coalesce(new.author, 'מגיב אנונימי'), '<', '&lt;'), '>', '&gt;');
  v_name := replace(replace(v_name, '<', '&lt;'), '>', '&gt;');

  v_url := case
    when new.target_key like 'place:%'
      then 'https://simpleisrael.co.il/places?p=' || substring(new.target_key from 7)
    else 'https://simpleisrael.co.il/?sel=' || new.target_key
  end;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_key,
                 'Content-Type',  'application/json'),
    body    := jsonb_build_object(
      'from',    v_from,
      'to',      jsonb_build_array(v_to),
      'subject', 'מישהו הגיב לתגובה שלך - ציר הזמן של עם ישראל',
      'html',
        '<div dir="rtl" style="font-family:system-ui,Arial,sans-serif;line-height:1.75;color:#222">'
        || '<p>' || v_name || ', התקבלה תשובה לתגובה שהשארת באתר:</p>'
        || '<blockquote style="border-right:3px solid #b28a2b;padding-right:12px;margin:14px 0;color:#444">'
        || '<b>' || v_who || ':</b><br>' || v_body || '</blockquote>'
        || '<p><a href="' || v_url || '" style="color:#163a57">לצפייה בדיון באתר</a></p>'
        || '<hr style="border:none;border-top:1px solid #e3ddd0;margin:22px 0">'
        || '<p style="font-size:12px;color:#777">קיבלת הודעה זו כי השארת כתובת מייל בתגובה שלך. '
        || 'להפסקת עדכונים - השיבו למייל הזה.</p></div>')
  );
  return new;
exception when others then
  /* תגובה שנכתבה חייבת להתפרסם גם אם המייל נכשל - ולכן בולעים. אבל
     בליעה שקטה משאירה אותך בלי שום עקבות כשלא מגיע מייל, ולכן הכישלון
     נרשם ביומן. Supabase -> Logs -> Postgres, חיפוש notify_comment_reply. */
  raise warning 'notify_comment_reply failed: % / %', sqlstate, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_comment_reply on comments;
create trigger trg_notify_comment_reply
  after insert on comments
  for each row execute function notify_comment_reply();

-- ============================================================================
--  בדיקה
-- ============================================================================
-- 1. כתוב תגובה באתר עם כתובת המייל שלך.
-- 2. השב לה (מדפדפן אחר או בחלון נסתר) בלי למלא מייל.
-- 3. המייל אמור להגיע. לבדיקת הקריאות היוצאות:
--      select created, status_code, left(content, 200) from net._http_response
--       order by created desc limit 5;
--
-- כמה מגיבים השאירו כתובת (הערך עצמו לא נחוץ לך כאן):
--   select count(*) filter (where notify_email is not null) as with_mail,
--          count(*) as total from comments where target_key <> 'admin:notes';
