-- ============================================================================
--  "סדר את הציר" במספרים - לשונית "משחק" במסך הניהול
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  אותו דפוס של admin_traffic: פונקציית security definer שמוודאת את טוקן
--  הניהול ומחזירה סיכומים בלבד - אף שורה גולמית ואף מזהה ביקור לא יוצאים.
--
--  🔑 אין כאן מקום להדביק טוקן, ובכוונה. הבלוק שולף אותו מתוך admin_inbox
--     הקיימת ובונה איתו את הפונקציה ("לשלוף, להחליף ולהחזיר" מ-CLAUDE.md).
--     תלוי ב-admin_inbox.sql (עם טוקן) וב-si_trail.sql.
--
--  מה חוזר (jsonb אחד):
--    visitors   ביקורים שבהם המשחק נפתח (game_start)
--    players    ביקורים שבהם לפחות סבב אחד נבדק (game_done)
--    rounds     סבבים שנבדקו; daily/free לפי סוג
--    avg_daily / avg_free   ציון ממוצע (0-5)
--    scores     {"0":n, ..., "5":n} - התפלגות הציונים
--    shares / share_players  שיתופים שהושלמו, וכמה ביקורים שיתפו
--    days       [{day, players, rounds, avg, shares}] לפי שעון ישראל
--    items      [{key, seen, miss}] - כמה פעמים פריט הופיע ביד וכמה פעמים לא
--               הונח במקומו. נאסף רק מאוקטובר 2026 (hand/miss ב-game_done)
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
create or replace function admin_game(p_token text, p_from date, p_to date)
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
    select t.name, t.session, t.props,
           (t.created_at at time zone 'Asia/Jerusalem')::date as d
      from si_trail t
     where t.name in ('game_start', 'game_done', 'game_share')
       and t.created_at >= (p_from::timestamp at time zone 'Asia/Jerusalem')
       and t.created_at <  ((p_to + 1)::timestamp at time zone 'Asia/Jerusalem')
  ), done as (
    select session, d, props->>'mode' as mode, (props->>'score')::int as score, props
      from ev where name = 'game_done' and props->>'score' ~ '^[0-5]$'
  )
  select jsonb_build_object(
    'visitors',      (select count(distinct session) from ev where name = 'game_start'),
    'players',       (select count(distinct session) from done),
    'rounds',        (select count(*) from done),
    'daily',         (select count(*) from done where mode = 'daily'),
    'free',          (select count(*) from done where mode = 'free'),
    'avg_daily',     (select round(avg(score), 2) from done where mode = 'daily'),
    'avg_free',      (select round(avg(score), 2) from done where mode = 'free'),
    'scores',        (select coalesce(jsonb_object_agg(score, n), '{}'::jsonb)
                        from (select score, count(*) as n from done group by score) s),
    'shares',        (select count(*) from ev where name = 'game_share'),
    'share_players', (select count(distinct session) from ev where name = 'game_share'),
    'days', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
               select g::date as day,
                      (select count(distinct session) from done where done.d = g::date) as players,
                      (select count(*) from done where done.d = g::date) as rounds,
                      (select round(avg(score), 2) from done where done.d = g::date) as avg,
                      (select count(*) from ev where ev.name = 'game_share' and ev.d = g::date) as shares
                 from generate_series(p_from, p_to, interval '1 day') as g) x),
    'items', (select coalesce(jsonb_agg(i order by i.miss desc, i.seen desc), '[]'::jsonb) from (
               select k as key,
                      count(*) as seen,
                      count(*) filter (where k = any(string_to_array(coalesce(done.props->>'miss', ''), ','))) as miss
                 from done, unnest(string_to_array(done.props->>'hand', ',')) as k
                where done.props ? 'hand'
                group by k) i)
  ) into res;
  return res;
end;
$body$;
$f$, tok);
end
$do$;

grant execute on function admin_game(text, date, date) to anon, authenticated;
