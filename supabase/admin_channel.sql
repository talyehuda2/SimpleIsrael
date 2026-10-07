-- ============================================================================
--  ערוץ הוואטסאפ - מאיפה באתר לוחצים על הקישור לערוץ (לשונית "כניסות")
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  וואטסאפ לא מספר מאיזה קישור הגיע מצטרף, ולכן נספרת הלחיצה באתר:
--  channel_click {from} - menu (תפריט "עוד באתר"), about (חלונית "אודות"),
--  game (מסך התוצאה של האתגר היומי), board (טבלת המובילים). ראו src/components/channel.js.
--  לחיצה אינה הצטרפות - את מספר העוקבים רואים בוואטסאפ עצמו.
--
--  אותו דפוס של admin_sources: security definer, טוקן הניהול נשלף מתוך
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
create or replace function admin_channel(p_token text, p_from date, p_to date)
returns table (src text, clicks int, visits int)
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

  return query
    select coalesce(t.props->>'from', '?'), count(*)::int, count(distinct t.session)::int
      from si_trail t
     where t.name = 'channel_click'
       and t.created_at >= (p_from::timestamp at time zone 'Asia/Jerusalem')
       and t.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Jerusalem')
     group by 1
     order by 2 desc;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_channel(text, date, date) to anon, authenticated;
