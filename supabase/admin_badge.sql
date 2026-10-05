-- ============================================================================
--  תג "✓ מהאתר" על תגובות של מנהל האתר
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  הבעיה: השם על תגובה הוא מה שהכותב הקליד. כל אחד יכול לכתוב "מנהל האתר"
--  או "טל", ולכן שם אינו ראיה. התג צריך לבוא ממקום שגולש לא יכול לכתוב אליו.
--
--  הפתרון, שלושה חלקים:
--    1. עמודה by_admin. גולש (anon / authenticated) לא יכול להדליק אותה:
--       טריגר מאפס אותה בכל הוספה שלו, ואינו נותן לשנות אותה בעדכון.
--    2. admin_post_comment - פונקציית security definer שמוודאת את טוקן
--       הניהול ורק היא כותבת by_admin = true. מסך הניהול וכרטיס האתר (כשהטוקן
--       שמור בדפדפן) שולחים דרכה.
--    3. השמות "מנהל", "admin" ודומיהם שמורים: גולש שמקליד אותם נחסם, כדי
--       שלא יהיה "מנהל האתר" בלי תג לצד "מנהל האתר" עם תג.
--
--  הטריגר מבחין בגולש לפי current_user. הוספה שבאה מתוך admin_post_comment
--  רצה כבעלים של הפונקציה (security definer), ולכן אינה anon. ⚠️ זו הסיבה
--  שפונקציית הטריגר עצמה אינה security definer - אחרת current_user בתוכה
--  היה תמיד הבעלים, וכל גולש היה עובר.
--
--  🔑 אין כאן מקום להדביק טוקן, ובכוונה: כמו admin_game.sql, הבלוק שולף אותו
--     מתוך admin_inbox הקיימת ("לשלוף, להחליף ולהחזיר" מ-CLAUDE.md).
--     תלוי ב-admin_inbox.sql (עם טוקן).
-- ============================================================================

alter table comments add column if not exists by_admin boolean not null default false;

-- הרשאת עמודה מפורשת: התגובות נקראות מהדפדפן, ו-contact / notify_email
-- כבר נשללו ברמת עמודה. אם הקריאה מוגדרת עמודה-עמודה, עמודה חדשה לא נכללת
-- מעצמה. אם היא ברמת הטבלה - השורה הזו לא משנה דבר.
grant select (by_admin) on comments to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1 + 3: השומר
create or replace function comments_guard_admin()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then
      new.by_admin := old.by_admin;
    else
      new.by_admin := false;
      if new.author is not null and new.author ~* '(מנהל|אדמין|admin|simpleisrael)' then
        raise sqlstate 'PT403'
          using message = 'השם הזה שמור למנהל האתר. בחרו שם אחר.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_guard_admin on comments;
create trigger on_comment_guard_admin
  before insert or update on comments
  for each row execute function comments_guard_admin();

-- ----------------------------------------------------------------------------
-- 2: כתיבה כמנהל
do $do$
declare
  tok text;
begin
  select substring(prosrc from $re$p_token <> '([^']+)'$re$) into tok
    from pg_proc where proname = 'admin_inbox' limit 1;
  if tok is null or tok like '<<<%' then
    raise exception 'לא נמצא טוקן ב-admin_inbox. קודם להריץ את admin_inbox.sql עם הטוקן.';
  end if;

  execute format($f$
create or replace function admin_post_comment(
  p_token text, p_body text, p_parent bigint default null,
  p_target_key text default null, p_target_label text default null
)
returns table (id bigint, created_at timestamptz, author text, body text, parent_id bigint, by_admin boolean)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_key   text := p_target_key;
  v_label text := p_target_label;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if p_token is null or p_token <> %L then
    raise exception 'טוקן ניהול שגוי';
  end if;
  if v_body = '' or length(v_body) > 1000 then
    raise exception 'תוכן ריק או ארוך מדי';
  end if;
  -- תשובה יורשת את היעד מהתגובה שעליה עונים, כמו בהוספה של גולש
  if p_parent is not null then
    select c.target_key, c.target_label into v_key, v_label
      from comments c where c.id = p_parent;
    if v_key is null then
      raise exception 'התגובה שעליה עונים לא נמצאה';
    end if;
  end if;
  if v_key is null or lower(v_key) like 'admin:%%' then
    raise exception 'יעד לא תקין';
  end if;

  -- הטריגר notify_comment_reply רץ גם כאן, ולכן מי שהשאיר מייל יקבל אותו
  return query
    insert into comments as c (target_key, target_label, parent_id, author, body, by_admin)
    values (v_key, v_label, p_parent, 'מנהל האתר', v_body, true)
    returning c.id, c.created_at, c.author, c.body, c.parent_id, c.by_admin;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_post_comment(text, text, bigint, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- תשובות שכבר נשלחו ממסך הניהול נכתבו בשם "מנהל האתר". לפני ההרצה הזו כל
-- אחד יכול היה לבחור את השם הזה, ולכן כדאי להציץ קודם במה שיסומן:
--   select id, created_at, target_label, body from comments
--    where author = 'מנהל האתר' and by_admin = false;
update comments set by_admin = true
 where author = 'מנהל האתר' and by_admin = false
   and lower(coalesce(target_key, '')) not like 'admin:%';
