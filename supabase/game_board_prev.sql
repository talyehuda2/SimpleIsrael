-- ============================================================================
--  טבלת המובילים: גם "החודש הקודם" - כדי לדעת מי ניצח
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  המנצחים בכל חודש עברי מתפרסמים בערוץ הוואטסאפ (בהחלטת בעל האתר, אוקטובר
--  2026). אבל בראש החודש הטבלה מתאפסת, ומי שפותח את האתר כבר רואה את החודש
--  החדש - הדירוג של החודש שהסתיים נעלם מכל מסך. 'prev' מחזיר אותו: מראש החודש
--  הקודם ועד לפני ראש החודש הנוכחי. מסך הניהול מציג אותו ("מנצחי החודש הקודם").
--
--  זו אותה game_board של game_board_month.sql, ובנוסף גבול עליון (until) - בלעדיו
--  'prev' היה סופר גם את ימי החודש הנוכחי. אין כאן סוד. תלוי ב-game_board_month.sql
--  (hebrew_month_start).
-- ============================================================================

create or replace function game_board(p_range text default 'month')
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  since date;
  until date := today + 1;   -- לא כולל
  res jsonb;
begin
  if p_range = 'all' then
    since := date '2000-01-01';
  elsif p_range = 'week' then
    since := today - extract(dow from today)::int;   -- dow: ראשון = 0
  elsif p_range = 'prev' then
    until := hebrew_month_start(today);
    since := hebrew_month_start(until - 1);
  else
    since := hebrew_month_start(today);
  end if;

  with t as (
    select s.user_id, p.nickname, sum(s.score)::int as points, count(*)::int as days
      from game_scores s join game_players p using (user_id)
     where s.day >= since and s.day < until and not p.hidden
     group by s.user_id, p.nickname
  ), r as (
    -- שוויון בנקודות: מי ששיחק פחות ימים ראשון (ממוצע גבוה יותר)
    select *, rank() over (order by points desc, days asc) as rank from t
  )
  select jsonb_build_object(
    'since', since,
    'until', until,
    'top',   (select coalesce(jsonb_agg(jsonb_build_object(
                'rank', rank, 'nickname', nickname, 'points', points, 'days', days,
                'me', user_id = auth.uid()) order by rank, nickname), '[]'::jsonb)
                from (select * from r order by rank, nickname limit 20) x),
    'me',    (select jsonb_build_object('rank', rank, 'points', points, 'days', days)
                from r where user_id = auth.uid()),
    'players', (select count(*) from r)
  ) into res;
  return res;
end;
$body$;

grant execute on function game_board(text) to anon, authenticated;
