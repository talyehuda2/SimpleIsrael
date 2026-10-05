-- ============================================================================
--  מאיפה מגיעים - פירוט מקורות בלשונית "כניסות" במסך הניהול
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  כל ביקור נספר פעם אחת, לפי ה-page_view הראשון שלו בטווח: מי שנכנס
--  מהסטטוס ואחר כך עבר למסע הדורות הוא כניסה אחת מהסטטוס, לא שתיים.
--  המקור הוא src מהקישור (status, card-share, game-share, reply-mail...)
--  ואם אין - הדומיין המפנה (ref). בלי שניהם - "ישיר". השיוך לקבוצות
--  (גוגל, רשתות חברתיות...) נעשה במסך, כדי שקבוצה חדשה לא תדרוש SQL.
--
--  אותו דפוס של admin_traffic: security definer, בודקת את טוקן הניהול,
--  ומחזירה ספירות בלבד - צירופים של (src, ref) ומספר ביקורים לכל אחד.
--
--  🔑 אין כאן מקום להדביק טוקן: הבלוק שולף אותו מתוך admin_inbox הקיימת.
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
create or replace function admin_sources(p_token text, p_from date, p_to date)
returns table (src text, ref text, visits int)
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
    with first_view as (
      select distinct on (t.session) t.props->>'src' as src, t.ref
        from si_trail t
       where t.name = 'page_view'
         and t.created_at >= (p_from::timestamp at time zone 'Asia/Jerusalem')
         and t.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Jerusalem')
       order by t.session, t.created_at
    )
    select f.src, f.ref, count(*)::int
      from first_view f
     group by f.src, f.ref
     order by count(*) desc
     limit 300;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_sources(text, date, date) to anon, authenticated;
