-- ============================================================================
--  התראה יומית לטלפון: "דמות היום" (Web Push)
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  גולש שאישר התראות נרשם כאן כ"מנוי" של הדפדפן שלו: כתובת שירות ההתראות
--  (endpoint) ושני מפתחות הצפנה. אין שם, אין מייל ואין מיקום - ומי שמבטל,
--  השורה שלו נמחקת. api/push-daily.js (Cron של Vercel) שולח פעם ביום.
--
--  מפתחות VAPID (החתימה של האתר על ההתראות) נוצרים בשרת בפעם הראשונה
--  שמבקשים אותם, ונשמרים בטבלה כאן - לא בקוד, לא ב-Vercel ולא בצ'אט, כמו
--  שאר הסודות של האתר. המפתח הציבורי ציבורי מעצם הגדרתו; הפרטי נקרא רק
--  עם NOTIFY_SECRET, שנשלף כאן מ-push_admin_alert ולא מודבק בקובץ.
--
--  אבטחה:
--  - לטבלאות אין policy ואין גישה מהדפדפן. הכל דרך הפונקציות.
--  - push_subscribe מקבלת רק כתובות של שירותי ההתראות המוכרים (גוגל, מוזילה,
--    אפל, מיקרוסופט) - אחרת השליחה היומית הייתה שולחת בקשות לכל כתובת שמישהו
--    הכניס.
--  - push_claim מסמנת את היום לפני השליחה, ולכן הפעלה כפולה של ה-Cron לא
--    שולחת פעמיים.
-- ============================================================================

create table if not exists push_subs (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_day   date,                       -- היום (שעון ישראל) של ההתראה היומית האחרונה
  welcomed   boolean not null default false
);
alter table push_subs enable row level security;
revoke all on push_subs from anon, authenticated;

create table if not exists push_keys (
  id         int primary key default 1 check (id = 1),
  pub        text not null,
  priv       text not null,
  created_at timestamptz not null default now()
);
alter table push_keys enable row level security;
revoke all on push_keys from anon, authenticated;

-- ----------------------------------------------------------------------------
-- מהדפדפן: הרשמה וביטול. מי שיודע את ה-endpoint הוא הדפדפן עצמו.
create or replace function push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or length(p_endpoint) > 1000 or p_endpoint !~
     '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/' then
    raise exception 'כתובת התראות לא מוכרת';
  end if;
  if p_p256dh is null or length(p_p256dh) not between 40 and 200
     or p_auth is null or length(p_auth) not between 8 and 100 then
    raise exception 'מפתחות לא תקינים';
  end if;
  insert into push_subs (endpoint, p256dh, auth) values (p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create or replace function push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$ delete from push_subs where endpoint = p_endpoint; $$;

grant execute on function push_subscribe(text, text, text) to anon, authenticated;
grant execute on function push_unsubscribe(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- מהשרת בלבד (api/push.js, api/push-daily.js), עם NOTIFY_SECRET
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

  -- המפתחות: נכתבים פעם אחת. קריאה שנייה (או שתי קריאות במקביל) מחזירה את הקיימים
  execute format($f$
create or replace function push_keys_get(p_secret text, p_pub text default null, p_priv text default null)
returns table (pub text, priv text)
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  if p_pub is not null and p_priv is not null then
    insert into push_keys (id, pub, priv) values (1, p_pub, p_priv) on conflict (id) do nothing;
  end if;
  return query select k.pub, k.priv from push_keys k where k.id = 1;
end;
$body$;
$f$, sec);

  -- התור של היום: מסמנת ומחזירה. מה שסומן לא יחזור באותו יום, גם אם ה-Cron רץ שוב
  execute format($f$
create or replace function push_claim(p_secret text, p_day date, p_limit int default 500)
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
        where x.last_day is distinct from p_day
        order by x.created_at
        limit p_limit
        for update skip locked)
    returning s.endpoint, s.p256dh, s.auth;
end;
$body$;
$f$, sec);

  -- מנוי ששירות ההתראות אמר שאינו קיים עוד (404/410) - נמחק
  execute format($f$
create or replace function push_gone(p_secret text, p_endpoints text[])
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  delete from push_subs where endpoint = any(p_endpoints);
end;
$body$;
$f$, sec);

  -- התראת "נרשמת": רק למנוי שנוצר בעשר הדקות האחרונות, ופעם אחת. כך הכתובת
  -- api/push לא יכולה לשמש להצפת מנויים קיימים בהתראות
  execute format($f$
create or replace function push_welcome(p_secret text, p_endpoint text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_secret is distinct from %L then raise exception 'unauthorized'; end if;
  return query
    update push_subs s set welcomed = true
     where s.endpoint = p_endpoint and not s.welcomed
       and s.created_at > now() - interval '10 minutes'
    returning s.endpoint, s.p256dh, s.auth;
end;
$body$;
$f$, sec);

  -- מסך הניהול: כמה מנויים, וכמה קיבלו את ההתראה של היום
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
    'week',  (select count(*) from push_subs where created_at > now() - interval '7 days'));
end;
$body$;
$f$, tok);
end
$do$;

revoke all on function push_keys_get(text, text, text) from public;
revoke all on function push_claim(text, date, int) from public;
revoke all on function push_gone(text, text[]) from public;
revoke all on function push_welcome(text, text) from public;
grant execute on function push_keys_get(text, text, text) to anon, authenticated;
grant execute on function push_claim(text, date, int) to anon, authenticated;
grant execute on function push_gone(text, text[]) to anon, authenticated;
grant execute on function push_welcome(text, text) to anon, authenticated;
grant execute on function admin_push_stats(text) to anon, authenticated;
