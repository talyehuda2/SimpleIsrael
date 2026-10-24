-- ============================================================================
--  התראות: שעה לבחירת הגולש
--  להריץ ב-Supabase אחרי push_game.sql: SQL Editor -> New query -> הדבקה -> Run.
--  בטוח לחזרה. אין בו מקום לסוד: NOTIFY_SECRET נשלף מ-push_admin_alert.
--
--  בעל האתר (אוקטובר 2026): כל גולש בוחר מתי תגיע ההתראה - 8:00, 13:00, 17:00
--  או 21:00 (ברירת המחדל, כמו עד עכשיו). השעות עצמן מוגדרות בקוד (SLOTS ב-
--  src/lib/holy.js) וב-Cron; כאן נשמרת רק השעה שנבחרה, ולכן שינוי ברשימה לא
--  דורש הרצה נוספת.
--
--  push_claim_slot מקבלת שעה ומחזירה את מי שבחר בה או בשעה מוקדמת יותר ועוד לא
--  קיבל היום: מי שהשעה שלו נפלה בשבת או בחג מקבל במוצאיהם, וב"הפעלה האחרונה"
--  לפני שבת (13:00 בערב שבת) השרת שולח 24 - כולם.
-- ============================================================================

alter table push_subs add column if not exists hour smallint not null default 21;
do $$ begin
  alter table push_subs add constraint push_subs_hour check (hour between 0 and 23);
exception when duplicate_object then null; end $$;

-- push_set_prefs מקבלת גם שעה. החתימה הקודמת נמחקת - שתי גרסאות היו מבלבלות את
-- PostgREST בקריאה בלי p_hour. דפדפן עם הגרסה הקודמת קורא בלי p_hour, וזה עובד
drop function if exists push_set_prefs(text, text, boolean);
create or replace function push_set_prefs(p_endpoint text, p_freq text default null, p_game boolean default null, p_hour int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_freq is not null and p_freq not in ('daily', 'alt', 'twice', 'weekly', 'none') then
    raise exception 'תדירות לא מוכרת';
  end if;
  if p_hour is not null and p_hour not between 0 and 23 then raise exception 'שעה לא תקינה'; end if;
  update push_subs
     set freq = coalesce(p_freq, freq), game = coalesce(p_game, game), hour = coalesce(p_hour, hour)
   where endpoint = p_endpoint;
end;
$$;

create or replace function push_get_prefs(p_endpoint text)
returns jsonb
language sql
security definer
set search_path = public
as $$ select jsonb_build_object('freq', freq, 'game', game, 'hour', hour) from push_subs where endpoint = p_endpoint; $$;

grant execute on function push_set_prefs(text, text, boolean, int) to anon, authenticated;
grant execute on function push_get_prefs(text) to anon, authenticated;

do $do$
declare
  sec text;
begin
  select substring(prosrc from $re$v_secret text := '([^']+)'$re$) into sec
    from pg_proc where proname = 'push_admin_alert' limit 1;
  if sec is null or sec like '<<<%' then
    raise exception 'לא נמצא NOTIFY_SECRET ב-push_admin_alert.';
  end if;

  -- כמו push_claim_evening (push_game.sql), ורק מי שהשעה שלו הגיעה
  execute format($f$
create or replace function push_claim_slot(p_secret text, p_day date, p_freqs text[], p_hour int, p_limit int default 500)
returns table (endpoint text, p256dh text, auth text, game_due boolean)
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  return query
    with picked as (
      select x.endpoint, (x.game and x.game_day is distinct from p_day) as g
        from push_subs x
       where x.last_day is distinct from p_day
         and x.hour <= p_hour
         and (x.freq = any(p_freqs) or (x.game and x.game_day is distinct from p_day))
       order by x.created_at
       limit p_limit
       for update skip locked)
    update push_subs s
       set last_day = p_day,
           game_day = case when picked.g then p_day else s.game_day end
      from picked
     where s.endpoint = picked.endpoint
    returning s.endpoint, s.p256dh, s.auth, picked.g;
end;
$body$;
$f$, sec);
end
$do$;

revoke all on function push_claim_slot(text, date, text[], int, int) from public;
grant execute on function push_claim_slot(text, date, text[], int, int) to anon, authenticated;

notify pgrst, 'reload schema';
