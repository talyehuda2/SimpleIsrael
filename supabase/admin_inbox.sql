-- ============================================================================
--  תיבת הדואר של המנהל - קריאה מהטלפון
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  הצורך: פניות "הערה למנהל" נשמרות עם target_key='admin:notes' ואף אחד לא
--  קורא אותן. anon כותב ולא קורא (זו ההגנה, והיא נכונה), ולכן עד היום הדרך
--  היחידה לראות פנייה הייתה המייל שהטריגר שולח - ואין שום דרך לענות לה
--  חוץ מלשבת מול SQL Editor.
--
--  הפתרון כאן הוא אותו דפוס של admin_delete_comment: פונקציית security
--  definer שמוודאת טוקן. אין צורך בשום מפתח חדש בצד השרת, ולכן /admin עובד
--  מכל דפדפן שבו הוקלד הטוקן - כולל הטלפון.
--
--  ⚠️ יש כאן מקום אחד שאתה ממלא בעצמך, מסומן ב-<<< >>>: אותו טוקן ניהול
--     שכבר יושב ב-admin_delete_comment. לראות אותו:
--       select prosrc from pg_proc where proname = 'admin_delete_comment';
--
--  תלוי ב-contact_column.sql וב-comment_reply_mail.sql (העמודות contact
--  ו-notify_email). אם אחד מהם לא רץ - הרצה כאן תיכשל, וזה הסימן.
-- ============================================================================

-- "טופל" הוא מה שמאפשר לתיבה להתרוקן. בלעדיו כל פנייה נשארת חדשה לנצח,
-- והמסך הופך לערימה שאי אפשר לעבוד מולה.
alter table comments add column if not exists handled_at timestamptz;

-- ----------------------------------------------------------------------------
-- קריאת התיבה: פניות פרטיות ותגובות ציבוריות באותה שליפה. המסך מפריד
-- ביניהן לפי target_key, כך שדף אחד מציג את שתי התיבות בלי שתי בקשות.
create or replace function admin_inbox(p_token text, p_limit int default 200)
returns table (
  id          bigint,
  created_at  timestamptz,
  target_key  text,
  target_label text,
  author      text,
  body        text,
  parent_id   bigint,
  contact     text,
  will_email  boolean,
  handled_at  timestamptz
)
language plpgsql
security definer                      -- נדרש: בלי זה הפונקציה רצה כ-anon,
set search_path = public              -- ש-contact ו-notify_email נשללו ממנו
as $$
begin
  if p_token is null or p_token <> '<<< כאן מדביקים את טוקן הניהול >>>' then
    raise exception 'טוקן ניהול שגוי';
  end if;

  return query
    select c.id, c.created_at, c.target_key, c.target_label, c.author, c.body,
           c.parent_id, c.contact,
           -- הכתובת עצמה לא יוצאת מכאן: למנהל מספיק לדעת שתשובה שלו תגיע
           -- למגיב במייל. פרטי קשר של פנייה פרטית כן יוצאים - הם נמסרו
           -- במפורש כדי שאפשר יהיה לחזור אליהם.
           (c.notify_email is not null and btrim(c.notify_email) <> ''),
           c.handled_at
      from comments c
     order by c.created_at desc
     limit greatest(1, least(p_limit, 500));
end;
$$;

-- ----------------------------------------------------------------------------
-- סימון פנייה כטופלת, ובחזרה
create or replace function admin_mark_handled(p_id bigint, p_token text, p_handled boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token <> '<<< כאן מדביקים את טוקן הניהול >>>' then
    raise exception 'טוקן ניהול שגוי';
  end if;
  update comments
     set handled_at = case when p_handled then now() else null end
   where id = p_id;
end;
$$;

-- הפונקציות מוגנות בטוקן שבתוכן, ולכן חשיפתן ל-anon אינה חושפת דבר
grant execute on function admin_inbox(text, int)               to anon, authenticated;
grant execute on function admin_mark_handled(bigint, text, boolean) to anon, authenticated;
