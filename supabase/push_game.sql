-- ============================================================================
--  התראות: תזכורת לאתגר היומי במשחק
--  להריץ ב-Supabase אחרי push.sql ו-push_freq.sql: SQL Editor -> New query ->
--  הדבקה -> Run. בטוח לחזרה. אין בו מקום לסוד: NOTIFY_SECRET נשלף מ-push_admin_alert
--  והטוקן מ-admin_inbox, כמו בשאר הקבצים.
--
--  בעל האתר (אוקטובר 2026): כמעט אף אחד לא חוזר לשחק למחרת - כנראה שוכחים. מי
--  שמשחק מקבל הצעה לתזכורת ב-21:00, באותה הפעלה של ההתראה היומית
--  (api/push-daily.js). מנוי עם תזכורת שעוד לא שיחק היום מקבל אותה *במקום* דמות
--  היום - לא שתי התראות באותה דקה.
--
--  game      - ביקש תזכורת למשחק.
--  game_day  - היום (שעון ישראל) שבו שיחק או קיבל תזכורת. הדפדפן מסמן אחרי
--              שפתר את האתגר (push_game_played), ולכן מי ששיחק לא מקבל תזכורת.
--  freq 'none' - בלי דמות יומית, רק התזכורת (ברירת המחדל למי שנרשם מהמשחק).
-- ============================================================================

alter table push_subs add column if not exists game boolean not null default false;
alter table push_subs add column if not exists game_day date;

alter table push_subs drop constraint if exists push_subs_freq;
alter table push_subs add constraint push_subs_freq check (freq in ('daily', 'alt', 'twice', 'weekly', 'none'));

-- ----------------------------------------------------------------------------
-- מהדפדפן. מי שיודע את ה-endpoint הוא הדפדפן עצמו, כמו ב-push_set_freq.
-- null = בלי שינוי
create or replace function push_set_prefs(p_endpoint text, p_freq text default null, p_game boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_freq is not null and p_freq not in ('daily', 'alt', 'twice', 'weekly', 'none') then
    raise exception 'תדירות לא מוכרת';
  end if;
  update push_subs set freq = coalesce(p_freq, freq), game = coalesce(p_game, game)
   where endpoint = p_endpoint;
end;
$$;

create or replace function push_get_prefs(p_endpoint text)
returns jsonb
language sql
security definer
set search_path = public
as $$ select jsonb_build_object('freq', freq, 'game', game) from push_subs where endpoint = p_endpoint; $$;

-- "שיחקתי היום". רק אתמול, היום או מחר (שעון ישראל) - לא תאריך שרירותי
create or replace function push_game_played(p_endpoint text, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update push_subs set game_day = p_day
   where endpoint = p_endpoint and game
     and p_day between (now() at time zone 'Asia/Jerusalem')::date - 1
                   and (now() at time zone 'Asia/Jerusalem')::date + 1;
$$;

grant execute on function push_set_prefs(text, text, boolean) to anon, authenticated;
grant execute on function push_get_prefs(text) to anon, authenticated;
grant execute on function push_game_played(text, date) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- מהשרת, עם הסוד
do $do$
declare
  sec text;
  tok text;
begin
  select substring(prosrc from $re$v_secret text := '([^']+)'$re$) into sec
    from pg_proc where proname = 'push_admin_alert' limit 1;
  if sec is null or sec like '<<<%' then
    raise exception 'לא נמצא NOTIFY_SECRET ב-push_admin_alert.';
  end if;
  select substring(prosrc from $re$p_token <> '([^']+)'$re$) into tok
    from pg_proc where proname = 'admin_inbox' limit 1;
  if tok is null or tok like '<<<%' then
    raise exception 'לא נמצא טוקן ב-admin_inbox.';
  end if;

  /* התור של היום: מי שהתדירות שלו בתור, ומי שביקש תזכורת ועוד לא שיחק. game_due
     אומר לשרת איזו התראה לשלוח לכל אחד. מה שסומן לא חוזר באותו יום */
  execute format($f$
create or replace function push_claim_evening(p_secret text, p_day date, p_freqs text[], p_limit int default 500)
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

  -- מסך הניהול: גם כמה ביקשו תזכורת למשחק
  execute format($f$
create or replace function admin_push_stats(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  if p_token is null or p_token <> %L then raise exception 'טוקן ניהול שגוי'; end if;
  return jsonb_build_object(
    'subs',  (select count(*) from push_subs),
    'today', (select count(*) from push_subs where last_day = today),
    'week',  (select count(*) from push_subs where created_at > now() - interval '7 days'),
    'game',  (select count(*) from push_subs where game));
end;
$body$;
$f$, tok);
end
$do$;

revoke all on function push_claim_evening(text, date, text[], int) from public;
grant execute on function push_claim_evening(text, date, text[], int) to anon, authenticated;
grant execute on function admin_push_stats(text) to anon, authenticated;
