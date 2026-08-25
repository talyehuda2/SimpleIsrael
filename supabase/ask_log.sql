-- ============================================================================
--  שכבת ההגבלה של סוכן השאלות
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  אין כאן שום סוד, ולכן הקובץ הזה נמצא בגיט - בניגוד לפונקציות התגובות,
--  שמחזיקות טוקנים בתוך גוף הפונקציה ולכן לעולם לא נכתבות לקוד.
--  הטבלה נגישה אך ורק ל-service_role, כלומר רק לפונקציה שרצה ב-Vercel.
-- ============================================================================

create table if not exists ask_log (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  qhash       text        not null,          -- השאלה מנורמלת ואז sha256
  question    text        not null,          -- הטקסט כפי שנשאל, לקריאה שלך
  answer      text,                          -- null = לא נוצרה תשובה אמיתית
  cost_cents  numeric     not null default 0,
  served_from text        not null default 'model',   -- model | cache | admin
  ip_hash     text        not null           -- sha256(ip + מלח סודי), לא IP גולמי
);

create index if not exists ask_log_qhash_idx on ask_log (qhash, created_at desc);
create index if not exists ask_log_ip_idx    on ask_log (ip_hash, created_at desc);
create index if not exists ask_log_day_idx   on ask_log (created_at desc);

-- RLS דלוק בלי אף policy: אף מפתח ציבורי לא קורא ולא כותב כאן.
-- service_role עוקף RLS מעצם הגדרתו, וזה המפתח היחיד שהשרת מחזיק.
alter table ask_log enable row level security;

-- ----------------------------------------------------------------------------
--  ask_gate: בדיקה אחת שמחזירה מטמון, תקציב ומכסה בנסיעה אחת לבסיס הנתונים.
--  מוחזר jsonb כדי שאפשר יהיה להוסיף שדות בלי לשנות חתימה.
-- ----------------------------------------------------------------------------
create or replace function ask_gate(
  p_ip_hash      text,
  p_qhash        text,
  p_max_day      int,
  p_budget_cents numeric,
  p_cache_days   int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer text;
  v_spent  numeric;
  v_used   int;
begin
  -- 1. שאלה שכבר נענתה: חינם, מיידי, ובלי לגעת במכסה.
  --    גם תשובה שנוצרה בבדיקה של המנהל תקפה כאן - כך שכל בדיקה שלך
  --    מזריעה את המטמון לטובת הגולשים.
  select answer into v_answer
    from ask_log
   where qhash = p_qhash
     and answer is not null
     and created_at > now() - make_interval(days => p_cache_days)
   order by created_at desc
   limit 1;
  if v_answer is not null then
    return jsonb_build_object('allow', true, 'cached', v_answer);
  end if;

  -- 2. תקציב יומי כולל - מתג ההרג. שאלות המנהל אינן נספרות כאן:
  --    הן הוצאה מכוונת, ולא נכון שבדיקה שלך תנעל את האתר בפני הגולשים.
  select coalesce(sum(cost_cents), 0) into v_spent
    from ask_log
   where created_at > date_trunc('day', now())
     and served_from = 'model';
  if v_spent >= p_budget_cents then
    return jsonb_build_object('allow', false, 'reason', 'budget');
  end if;

  -- 3. מכסה יומית לגולש. חלון מתגלגל של 24 שעות ולא "יום קלנדרי",
  --    כדי שלא ייווצר תור בחצות.
  select count(*) into v_used
    from ask_log
   where ip_hash = p_ip_hash
     and served_from = 'model'
     and created_at > now() - interval '24 hours';
  if v_used >= p_max_day then
    return jsonb_build_object('allow', false, 'reason', 'quota', 'remaining', 0);
  end if;

  return jsonb_build_object('allow', true, 'remaining', p_max_day - v_used - 1);
end;
$$;

-- הפונקציה היא security definer, ובלי השורה הזו כל אחד היה יכול לקרוא לה
-- דרך ה-REST של Supabase עם המפתח הציבורי ולמפות את מצב המכסות.
revoke all on function ask_gate(text, text, int, numeric, int) from public;
revoke all on function ask_gate(text, text, int, numeric, int) from anon;
revoke all on function ask_gate(text, text, int, numeric, int) from authenticated;
grant execute on function ask_gate(text, text, int, numeric, int) to service_role;

-- ============================================================================
--  שאילתות תחזוקה
-- ============================================================================
-- מה נשאל הכי הרבה (זו רשימת שאלות הפתיחה האמיתית):
--   select question, count(*) from ask_log group by 1 order by 2 desc limit 30;
--
-- כמה עלה היום:
--   select served_from, count(*), round(sum(cost_cents), 2) as cents
--     from ask_log where created_at > date_trunc('day', now()) group by 1;
--
-- ניקוי המטמון אחרי עדכון נתונים באתר (התשובות הישנות עלולות להיות ישנות):
--   update ask_log set answer = null where answer is not null;
