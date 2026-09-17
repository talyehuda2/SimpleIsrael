-- ============================================================================
--  הזרקת HTML למייל היוצא דרך target_key  (OWASP A05:2025 - Injection)
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  🚨 מה הייתה הבעיה
--
--  notify_comment_reply בונה קישור מתוך new.target_key ומכניס אותו לתוך
--  href של מייל HTML. גוף התגובה ושם המגיב עוברים בריחה - הכתובת לא.
--  target_key מגיע מהדפדפן ונשלט בידי מי שכותב את התגובה, ולכן:
--
--    target_key = x"><a href="https://evil.example">אימות חשבון</a><!--
--
--  מייצר קישור זר בתוך מייל שנשלח **לגולש אחר**, מהדומיין המאומת שלך.
--  זה לא XSS בדפדפן אלא דיוג: הנמען רואה מייל אותנטי מהאתר עם קישור
--  שהתוקף שתל. אומת מקומית מול Postgres 16 לפני התיקון ואחריו.
--
--  🛠 התיקון, ולמה כך
--
--  לא בריחה של תווים אלא **אימות מול רשימה לבנה**: כתובת שאינה נראית
--  כמו אחת משתי הכתובות הלגיטימיות של האתר מוחלפת בשורש. בריחה מתקנת
--  את המופע הזה; אימות מונע את המחלקה כולה, כולל שימושים עתידיים.
--
--  הפונקציה אינה נכתבת כאן מחדש אלא נערכת במקום - pg_get_functiondef -
--  כי מפתח Resend יושב בתוכה. אותו דפוס שמתועד ב-CLAUDE.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. השומר. immutable כי אין לו תלות במצב, וכך אפשר להשתמש בו גם באינדקס.
--
--  התו & נדחה אף שאינו מסוכן ב-href: הוא אינו מופיע באף מפתח לגיטימי
--  באתר, ורשימה לבנה צרה מדי נופלת לשורש - שזו תקלה נראית לעין. רשימה
--  רחבה מדי נופלת לדיוג, שאינו נראה כלל.
-- ----------------------------------------------------------------------------
create or replace function safe_site_url(p_url text)
returns text
language sql
immutable
as $$
  select case
    when p_url ~ '^https://simpleisrael\.co\.il/(\?sel=|places\?p=)[^[:space:]"''<>&\\]+$'
      then p_url
    else 'https://simpleisrael.co.il/'
  end;
$$;

-- ----------------------------------------------------------------------------
--  2. החלת השומר על הפונקציה החיה, בלי לגעת במפתח שבתוכה.
-- ----------------------------------------------------------------------------
do $do$
declare
  r record; def text; n int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosrc like '%|| v_url ||%'
      and p.prosrc not like '%safe_site_url%'
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, '|| v_url ||', '|| safe_site_url(v_url) ||');
    execute def;
    n := n + 1;
    raise notice 'הוגן: %', r.proname;
  end loop;
  if n = 0 then
    raise notice 'לא נמצאה פונקציה להגנה - אולי כבר רץ';
  end if;
end
$do$;

-- ----------------------------------------------------------------------------
--  בדיקה:
--    select proname, prosrc like '%safe_site_url%' as מוגן
--    from pg_proc where prosrc like '%v_url%';
--
--    select safe_site_url('https://simpleisrael.co.il/?sel=leader:avraham');
--      -> חוזר כמות שהוא
--    select safe_site_url('https://simpleisrael.co.il/?sel=x" href="https://evil.example');
--      -> https://simpleisrael.co.il/
-- ----------------------------------------------------------------------------
