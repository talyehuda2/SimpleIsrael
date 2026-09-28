-- ============================================================================
--  כניסות לאתר לאורך זמן - לשונית "כניסות" במסך הניהול
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  si_trail היא כתיבה בלבד מהדפדפן, ולכן עד היום הדרך לראות תנועה הייתה
--  SQL Editor. זה אותו דפוס של admin_inbox: פונקציית security definer
--  שמוודאת את טוקן הניהול, ומחזירה ספירות בלבד - אף שורה גולמית לא יוצאת.
--
--  🔑 אין כאן מקום להדביק טוקן, ובכוונה. הבלוק למטה שולף את הטוקן מתוך
--     admin_inbox הקיימת ובונה איתו את הפונקציה - "לשלוף, להחליף ולהחזיר"
--     מ-CLAUDE.md - כך שהסוד לא עובר בצ'אט ולא נשמר בקובץ.
--     תלוי ב-admin_inbox.sql (עם טוקן) וב-si_trail.sql.
-- ============================================================================

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
create or replace function admin_traffic(p_token text, p_from date, p_to date)
returns table (
  day         date,
  visits      int,    -- ביקורים (טאבים) שבהם נטען מסך כלשהו
  from_status int,    -- מתוכם: הגיעו מקישור עם ?src=status
  timeline    int,    -- לפי מסך. ביקור שעבר בין מסכים נספר בכל אחד
  atlas       int,
  places      int
)
language plpgsql
security definer
set search_path = public
as $body$
#variable_conflict use_column
begin
  if p_token is null or p_token <> %L then
    raise exception 'טוקן ניהול שגוי';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'טווח תאריכים לא תקין (עד שנה)';
  end if;

  -- יום לפי שעון ישראל, לא UTC: אחרת ביקור ב-01:00 בלילה נרשם ליום הקודם.
  -- generate_series מחזיר גם ימים בלי כניסות - יום ריק הוא נתון, לא חור בגרף.
  return query
    with d as (
      select g::date as day from generate_series(p_from, p_to, interval '1 day') as g
    ), v as (
      select (t.created_at at time zone 'Asia/Jerusalem')::date as vday, t.session, t.path, t.props
        from si_trail t
       where t.name = 'page_view'
         and t.created_at >= (p_from::timestamp at time zone 'Asia/Jerusalem')
         and t.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Jerusalem')
    )
    select d.day,
           count(distinct v.session)::int,
           (count(distinct v.session) filter (where v.props->>'src' = 'status'))::int,
           (count(distinct v.session) filter (where v.path = '/'))::int,
           (count(distinct v.session) filter (where v.path like '/atlas%%'))::int,
           (count(distinct v.session) filter (where v.path like '/places%%'))::int
      from d left join v on v.vday = d.day
     group by d.day
     order by d.day;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_traffic(text, date, date) to anon, authenticated;
