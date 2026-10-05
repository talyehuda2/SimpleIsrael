-- ============================================================================
--  "סדר את הציר" - שחקנים רשומים, נקודות, רצף וטבלת מובילים
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  מה נכנס:
--    game_players   כינוי לכל משתמש רשום (auth.users), ודגל "מוסתר" למנהל
--    game_scores    שורה אחת לכל שחקן ליום: הציון באתגר היומי והסדר שהניח
--    game_record    הדרך היחידה לרשום ציון - רק מ-api/game.js (ראו למטה)
--    game_me / game_board / game_set_nickname / game_delete_me   לשחקן
--    admin_game_players / admin_game_hide                         למסך הניהול
--
--  🔑 למה ציון לא נכתב מהדפדפן: הדפדפן הוא שבודק את הסדר, ולכן כל אחד יכול
--     היה לשלוח 5/5 מהקונסול. הדפדפן שולח ל-api/game.js רק את הסדר שבחר;
--     הפונקציה שם מחשבת את היד של היום מאותו pool.js שהמשחק רץ עליו, נותנת
--     ציון וקוראת ל-game_record עם ה-JWT של השחקן ועם NOTIFY_SECRET.
--     הסוד הזה כבר משותף ל-Vercel ול-Postgres (push_admin_alert), ולכן אין
--     כאן מקום להדביק סוד חדש: הבלוק שולף אותו מתוך push_admin_alert
--     ("לשלוף, להחליף ולהחזיר" מ-CLAUDE.md), ואת הטוקן מתוך admin_inbox.
--     תלוי ב-notify_admin_note.sql וב-admin_inbox.sql (ממולאים).
--
--  למה לא לשמור את הידיים היומיות בטבלה: היד נגזרת מהתאריך ומנתוני התוכן,
--  שמשתנים כל הזמן. עותק כאן היה מתיישן בשקט, והשרת היה פוסל סדר נכון.
--
--  "יום" הוא תמיד תאריך בשעון ישראל - האתגר מתחלף בחצות כאן (israelDay).
-- ============================================================================

create table if not exists game_players (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
-- כינוי ייחודי בלי תלות ברישיות ("Tal" ו-"tal" הם אותו שחקן בטבלה)
create unique index if not exists game_players_nick on game_players (lower(nickname));

create table if not exists game_scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  score      smallint not null check (score between 0 and 5),
  placed     text[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists game_scores_day on game_scores (day);

/* אין policy לאף אחת מהטבלאות, ולכן RLS חוסם כל גישה ישירה מהדפדפן -
   גם קריאה. הכל עובר דרך הפונקציות למטה, שמחזירות רק כינוי ונקודות:
   מזהה משתמש ומייל לא יוצאים לאף אחד חוץ ממסך הניהול. */
alter table game_players enable row level security;
alter table game_scores  enable row level security;
revoke all on game_players, game_scores from anon, authenticated;

-- ----------------------------------------------------------------------------
--  כינוי: 2-20 תווים, אותיות עבריות או לטיניות, ספרות, רווח, נקודה, מקף.
--  השמות של מנהל האתר שמורים, כמו בתגובות (admin_badge.sql).
-- ----------------------------------------------------------------------------
create or replace function game_nick_ok(p text)
returns text
language plpgsql
immutable
as $$
declare
  n text := regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g');
begin
  if char_length(n) < 2 or char_length(n) > 20 then
    raise exception 'כינוי צריך להיות באורך 2 עד 20 תווים';
  end if;
  if n !~ '^[א-תa-zA-Z0-9 ._''-]+$' then
    raise exception 'בכינוי מותרים אותיות, ספרות, רווח, נקודה ומקף';
  end if;
  if n !~ '[א-תa-zA-Z]' then
    raise exception 'כינוי צריך לכלול לפחות אות אחת';
  end if;
  if lower(n) ~ '(מנהל|הנהלה|admin|moderator|simple ?israel|ציר הזמן)' then
    raise exception 'הכינוי הזה שמור';
  end if;
  return n;
end;
$$;

create or replace function game_set_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
begin
  if auth.uid() is null then raise exception 'נדרשת התחברות'; end if;
  n := game_nick_ok(p_nickname);
  insert into game_players (user_id, nickname) values (auth.uid(), n)
    on conflict (user_id) do update set nickname = excluded.nickname;
  return n;
exception when unique_violation then
  raise exception 'הכינוי הזה כבר תפוס';
end;
$$;

-- ----------------------------------------------------------------------------
--  רצף: ימים רצופים שבהם השחקן שלח את האתגר היומי, עד היום. רצף שהסתיים
--  אתמול עדיין חי - היום עוד לא נגמר, ומי ששיחק אתמול לא "שבר" אותו בבוקר.
-- ----------------------------------------------------------------------------
create or replace function game_streaks(p_user uuid, out cur int, out best int)
language sql
stable
as $$
  with d as (
    select day, day - (row_number() over (order by day))::int as grp
      from game_scores where user_id = p_user
  ), runs as (
    select max(day) as last_day, count(*)::int as len from d group by grp
  )
  select
    coalesce((select len from runs
               where last_day >= (now() at time zone 'Asia/Jerusalem')::date - 1
               order by last_day desc limit 1), 0),
    coalesce((select max(len) from runs), 0);
$$;

create or replace function game_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  s record;
begin
  if uid is null then raise exception 'נדרשת התחברות'; end if;
  select * into s from game_streaks(uid);
  return jsonb_build_object(
    'nickname', (select nickname from game_players where user_id = uid),
    'total',    (select coalesce(sum(score), 0) from game_scores where user_id = uid),
    'days',     (select count(*) from game_scores where user_id = uid),
    'streak',   s.cur,
    'best',     s.best,
    'today',    (select jsonb_build_object('score', score, 'placed', placed)
                   from game_scores where user_id = uid and day = today),
    -- 14 הימים האחרונים לשורת החרוזים באזור האישי; יום בלי משחק לא מוחזר
    'recent',   (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'score', score) order by day), '[]'::jsonb)
                   from game_scores where user_id = uid and day > today - 14)
  );
end;
$$;

-- ----------------------------------------------------------------------------
--  טבלת המובילים. 'week' = מיום ראשון האחרון (שעון ישראל), 'all' = מאז ומעולם.
--  פתוחה גם לאורחים: היא מה שמזמין להירשם. מחזירה כינויים ונקודות בלבד,
--  ואת המקום של השחקן המחובר גם כשהוא מחוץ לעשרים הראשונים.
-- ----------------------------------------------------------------------------
create or replace function game_board(p_range text default 'week')
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
  else
    since := today - extract(dow from today)::int;   -- dow: ראשון = 0
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

-- ----------------------------------------------------------------------------
--  מחיקת חשבון בידי השחקן. המחיקה מ-auth.users מושכת אחריה את הכינוי ואת
--  הציונים (on delete cascade), ולא נשאר שום זכר - זו זכות ולא בקשת טובה.
-- ----------------------------------------------------------------------------
create or replace function game_delete_me()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'נדרשת התחברות'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
--  הפונקציות שמחזיקות סוד נבנות בתוך בלוק, שמזריק אליהן את הסוד והטוקן
--  הקיימים. אף אחד מהם לא עובר בקובץ או בצ'אט.
-- ----------------------------------------------------------------------------
do $do$
declare
  sec text;
  tok text;
begin
  select substring(prosrc from $re$v_secret text := '([^']+)'$re$) into sec
    from pg_proc where proname = 'push_admin_alert' limit 1;
  if sec is null or sec like '<<<%' then
    raise exception 'לא נמצא NOTIFY_SECRET ב-push_admin_alert. קודם להריץ את notify_admin_note.sql ממולא.';
  end if;
  select substring(prosrc from $re$p_token <> '([^']+)'$re$) into tok
    from pg_proc where proname = 'admin_inbox' limit 1;
  if tok is null or tok like '<<<%' then
    raise exception 'לא נמצא טוקן ב-admin_inbox. קודם להריץ את admin_inbox.sql עם הטוקן.';
  end if;

  /* נקראת רק מ-api/game.js, עם ה-JWT של השחקן (auth.uid) ועם הסוד (הוכחה
     שהציון חושב בשרת). ציון ראשון ליום הוא הקובע: שליחה חוזרת לא דורסת
     אותו, ומחזירה את מה שנשמר - כך מכשיר שני לא מקבל "ניסיון נוסף".
     היום חייב להיות היום או אתמול בשעון ישראל: אתמול - בשביל מי שלחץ
     "בדיקה" שנייה לפני חצות והבקשה הגיעה אחריה. */
  execute format($f$
create or replace function game_record(p_secret text, p_day date, p_score int, p_placed text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $body$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Jerusalem')::date;
  r game_scores;
  fresh boolean := false;
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  if uid is null then raise exception 'נדרשת התחברות'; end if;
  if p_day not in (today, today - 1) then raise exception 'יום לא תקין'; end if;
  if p_score not between 0 and 5 or coalesce(array_length(p_placed, 1), 0) <> 5 then
    raise exception 'ציון לא תקין';
  end if;

  insert into game_scores (user_id, day, score, placed)
    values (uid, p_day, p_score, p_placed)
    on conflict (user_id, day) do nothing
    returning * into r;
  fresh := found;
  if not fresh then
    select * into r from game_scores where user_id = uid and day = p_day;
  end if;
  return jsonb_build_object('score', r.score, 'placed', r.placed, 'fresh', fresh);
end;
$body$;
$f$, sec);

  -- רשימת השחקנים למסך הניהול: כינוי, מייל, נקודות, ימים, רצף, הסתרה
  execute format($f$
create or replace function admin_game_players(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $body$
begin
  if p_token is null or p_token <> %L then raise exception 'טוקן ניהול שגוי'; end if;
  return (select coalesce(jsonb_agg(x order by x.points desc, x.created_at), '[]'::jsonb) from (
    select p.user_id, p.nickname, p.hidden, p.created_at, u.email,
           coalesce(sum(s.score), 0)::int as points, count(s.day)::int as days,
           max(s.day) as last_day
      from game_players p
      join auth.users u on u.id = p.user_id
      left join game_scores s on s.user_id = p.user_id
     group by p.user_id, p.nickname, p.hidden, p.created_at, u.email) x);
end;
$body$;
$f$, tok);

  -- הסתרה ולא מחיקה: כינוי פוגעני יוצא מהטבלה, והשחקן ממשיך לצבור לעצמו
  execute format($f$
create or replace function admin_game_hide(p_token text, p_user uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_token is null or p_token <> %L then raise exception 'טוקן ניהול שגוי'; end if;
  update game_players set hidden = p_hidden where user_id = p_user;
end;
$body$;
$f$, tok);
end
$do$;

revoke all on function game_record(text, date, int, text[]) from public, anon;
revoke all on function game_set_nickname(text), game_me(), game_delete_me() from public, anon;
revoke all on function game_streaks(uuid) from public, anon, authenticated;

grant execute on function game_record(text, date, int, text[]) to authenticated;
grant execute on function game_set_nickname(text), game_me(), game_delete_me() to authenticated;
grant execute on function game_board(text) to anon, authenticated;
grant execute on function admin_game_players(text), admin_game_hide(text, uuid, boolean) to anon, authenticated;
