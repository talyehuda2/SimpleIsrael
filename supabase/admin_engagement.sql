-- ============================================================================
--  עומק ביקור ו"מה הכי נפתח" - לשונית "כניסות" במסך הניהול
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  השאלה: האם אנשים נכנסים לכרטיס אחד ועוזבים, או ממשיכים לשני ולשלישי?
--  "עומק" של ביקור = כמה דמויות ומקומות שונים נפתחו בו (item_open בציר הזמן
--  ובמסע הדורות, place_open במפת הארץ). ביקור שרק נטען ולא נפתח בו דבר = 0.
--  ⚠️ במסע הדורות item_open נרשם רק מאוקטובר 2026; ביקורים שם מלפני כן
--     נספרים כעומק 0 גם אם נפתחו בהם כרטיסים.
--
--  אותו דפוס של admin_traffic: security definer, טוקן הניהול נשלף מתוך
--  admin_inbox, וחוזרות ספירות בלבד.
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
create or replace function admin_engagement(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  res jsonb;
begin
  if p_token is null or p_token <> %L then
    raise exception 'טוקן ניהול שגוי';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'טווח תאריכים לא תקין (עד שנה)';
  end if;

  with ev as (
    select t.name, t.session, t.props
      from si_trail t
     where t.name in ('page_view', 'item_open', 'place_open')
       and t.created_at >= (p_from::timestamp at time zone 'Asia/Jerusalem')
       and t.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Jerusalem')
  ), opened as (
    select session,
           case when name = 'item_open' then (props->>'kind') || ':' || (props->>'id')
                else 'place:' || (props->>'id') end as k
      from ev where name in ('item_open', 'place_open')
  ), per as (
    select v.session, count(distinct o.k) as n
      from (select distinct session from ev where name = 'page_view') v
      left join opened o on o.session = v.session
     group by v.session
  )
  select jsonb_build_object(
    'visits', (select count(*) from per),
    'depth', jsonb_build_object(
       '0',   (select count(*) from per where n = 0),
       '1',   (select count(*) from per where n = 1),
       '2',   (select count(*) from per where n = 2),
       '3-5', (select count(*) from per where n between 3 and 5),
       '6+',  (select count(*) from per where n >= 6)),
    'items', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
       select k as key, count(distinct session) as n from opened
        where k not like 'place:%%' group by k order by n desc limit 15) x),
    'places', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
       select substring(k from 7) as id, count(distinct session) as n from opened
        where k like 'place:%%' group by k order by n desc limit 10) x)
  ) into res;
  return res;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_engagement(text, date, date) to anon, authenticated;
