-- ============================================================================
--  התראה יומית: תדירות לבחירת הגולש
--  להריץ ב-Supabase אחרי push.sql: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  כל יום / יום כן יום לא / פעמיים בשבוע / פעם בשבוע (בקשת בעל האתר, אוקטובר
--  2026). איזו תדירות "בתור" היום מחשב השרת (freqsDue ב-src/lib/holy.js) ומעביר
--  ל-push_claim - כך הלוח (איזה יום בשבוע, שבת וחג) יושב במקום אחד, ב-JS.
--
--  push_set_freq / push_get_freq מהדפדפן: מי שיודע את ה-endpoint הוא הדפדפן
--  עצמו, כמו ב-push_unsubscribe. אין כאן סוד חדש.
-- ============================================================================

alter table push_subs add column if not exists freq text not null default 'daily';
do $$ begin
  alter table push_subs add constraint push_subs_freq check (freq in ('daily', 'alt', 'twice', 'weekly'));
exception when duplicate_object then null; end $$;

create or replace function push_set_freq(p_endpoint text, p_freq text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_freq not in ('daily', 'alt', 'twice', 'weekly') then raise exception 'תדירות לא מוכרת'; end if;
  update push_subs set freq = p_freq where endpoint = p_endpoint;
end;
$$;

create or replace function push_get_freq(p_endpoint text)
returns text
language sql
security definer
set search_path = public
as $$ select freq from push_subs where endpoint = p_endpoint; $$;

grant execute on function push_set_freq(text, text) to anon, authenticated;
grant execute on function push_get_freq(text) to anon, authenticated;

-- התור של היום, רק למי שהתדירות שלו "בתור". עם הסוד, כמו push_claim הקודמת
do $do$
declare
  sec text;
begin
  select substring(prosrc from $re$v_secret text := '([^']+)'$re$) into sec
    from pg_proc where proname = 'push_admin_alert' limit 1;
  if sec is null or sec like '<<<%' then
    raise exception 'לא נמצא NOTIFY_SECRET ב-push_admin_alert.';
  end if;

  execute format($f$
create or replace function push_claim_due(p_secret text, p_day date, p_freqs text[], p_limit int default 500)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  return query
    update push_subs s set last_day = p_day
     where s.endpoint in (
       select x.endpoint from push_subs x
        where x.last_day is distinct from p_day and x.freq = any(p_freqs)
        order by x.created_at
        limit p_limit
        for update skip locked)
    returning s.endpoint, s.p256dh, s.auth;
end;
$body$;
$f$, sec);
end
$do$;

revoke all on function push_claim_due(text, date, text[], int) from public;
grant execute on function push_claim_due(text, date, text[], int) to anon, authenticated;
