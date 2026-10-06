-- ============================================================================
--  טבלת המובילים: חודשית במקום שבועית
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  בהחלטת בעל האתר (אוקטובר 2026): הטבלה מתאפסת בכל 1 לחודש ולא בכל יום
--  ראשון. שבוע קצר מדי - מי שפספס יומיים כבר יצא מהמרוץ, וחודש נותן זמן
--  להתקדם בטבלה.
--
--  'month' = מה-1 לחודש הנוכחי (שעון ישראל), 'all' = מאז ומעולם. 'week' נשאר
--  כדי שדפדפן שעוד מחזיק את הגרסה הקודמת של המשחק לא יקבל שגיאה.
--  אין כאן סוד - game_board אינה מחזיקה טוקן או מפתח, ולכן היא נכתבת מחדש.
--  תלוי ב-game_accounts.sql.
-- ============================================================================

create or replace function game_board(p_range text default 'month')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  since date;
  res jsonb;
begin
  if p_range = 'all' then
    since := date '2000-01-01';
  elsif p_range = 'week' then
    since := today - extract(dow from today)::int;   -- dow: ראשון = 0
  else
    since := date_trunc('month', today)::date;        -- ה-1 לחודש
  end if;

  with t as (
    select s.user_id, p.nickname, sum(s.score)::int as points, count(*)::int as days
      from game_scores s join game_players p using (user_id)
     where s.day >= since and not p.hidden
     group by s.user_id, p.nickname
  ), r as (
    -- שוויון בנקודות: מי ששיחק פחות ימים ראשון (ממוצע גבוה יותר)
    select *, rank() over (order by points desc, days asc) as rank from t
  )
  select jsonb_build_object(
    'since', since,
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
$$;

grant execute on function game_board(text) to anon, authenticated;
