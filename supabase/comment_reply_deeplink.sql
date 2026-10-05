-- ============================================================================
--  קישור ישיר לתגובה מתוך המייל
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  הבעיה: במייל "ענו לך" הקישור "לצפייה בדיון באתר" פתח את הכרטיס, והגולש
--  היה צריך למצוא לבד את התגובות ואת התשובה בתוכן. עכשיו הקישור נושא גם
--  &c=<מספר התגובה>, והאתר פותח את התגובות, גולל אליה ומהבהב אותה.
--  ו-&src=reply-mail, כדי שאפשר יהיה לספור כמה חזרו לאתר מהמייל.
--
--  שני חלקים:
--    1. safe_site_url מקבלת את הסיומת הזו. בלעדיה הרשימה הלבנה דוחה כל & -
--       בכוונה, ראו comment_reply_url_fix.sql - והקישור היה נופל לשורש.
--       הסיומת מותרת רק בצורה המדויקת: מספר, ואחריו src באותיות ומקפים.
--    2. פונקציות המייל מוסיפות את הסיומת. הן מחזיקות את מפתח Resend, ולכן
--       לא נכתבות מחדש אלא "לשלוף, להחליף ולהחזיר" (CLAUDE.md): המפתח לא
--       עובר בצ'אט ולא בקובץ. רק פונקציות טריגר - רק בהן יש new.id.
-- ============================================================================

-- 1. השומר
create or replace function safe_site_url(p_url text)
returns text
language sql
immutable
as $$
  select case
    when p_url ~ '^https://simpleisrael\.co\.il/(\?sel=|places\?p=)[^[:space:]"''<>&\\]+(&c=[0-9]+(&src=[a-z-]+)?)?$'
      then p_url
    else 'https://simpleisrael.co.il/'
  end;
$$;

-- 2. הסיומת בפונקציות המייל.
--    הפונקציה החיה יכולה להיות באחת משתי צורות, ואין דרך לדעת מכאן איזו:
--      א. נבנתה מ-comment_reply_mail.sql:  v_url := safe_site_url(...)  ובקישור  || v_url ||
--      ב. ישנה יותר ותוקנה ב-comment_reply_url_fix.sql:  || safe_site_url(v_url) ||
--    לכן שתי ההחלפות. בשתיהן הכתובת המלאה עוברת שוב דרך safe_site_url, כך
--    שגם בצורה א' סיומת על כתובת שכבר נפלה לשורש נדחית, ולא נוצר קישור שבור.
do $do$
declare
  r record; def text; src text; sfx text; n int := 0;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
       and p.prosrc like '%v_url%'
       and p.prosrc not like '%&c=%'
  loop
    src := case when r.proname = 'notify_comment_reply' then 'reply-mail' else 'mail' end;
    sfx := $s$v_url || '&c=' || new.id || '&src=$s$ || src || $s$'$s$;
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'safe_site_url(v_url)', 'safe_site_url(' || sfx || ')');   -- צורה ב
    def := replace(def, '|| v_url ||', '|| safe_site_url(' || sfx || ') ||');      -- צורה א
    if def not like '%&c=%' then
      raise notice 'דילוג: % - לא נמצא בה קישור לעדכן', r.proname;
      continue;
    end if;
    execute def;
    n := n + 1;
    raise notice 'עודכן: % (src=%)', r.proname, src;
  end loop;
  if n = 0 then
    raise notice 'לא נמצאה פונקציה לעדכון - אולי כבר רץ';
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
--  בדיקה:
--    select proname from pg_proc where prosrc like '%&c=%';
--      -> notify_comment_reply (ואולי notify_new_comment)
--    select safe_site_url('https://simpleisrael.co.il/?sel=leader:avraham&c=12&src=reply-mail');
--      -> חוזר כמות שהוא
--    select safe_site_url('https://simpleisrael.co.il/?sel=leader:avraham&x=1');
--      -> https://simpleisrael.co.il/
-- ----------------------------------------------------------------------------
