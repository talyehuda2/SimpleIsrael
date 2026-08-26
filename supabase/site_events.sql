-- ============================================================================
--  אירועי שימוש באתר
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  למה כאן ולא ב-Vercel: אירועים מותאמים אינם נתמכים בחבילת Hobby, וגם
--  ב-Pro הם מוגבלים לשני מאפיינים לאירוע ולחלון דיווח של שנה. כאן אין
--  הגבלה, אין תפוגה, והנתונים שלך.
--  צפיות העמוד נשארות ב-Vercel - הן חינם ומגיעות עם מדינה ומכשיר.
-- ============================================================================

create table if not exists site_events (
  id         bigserial   primary key,
  created_at timestamptz not null default now(),
  name       text        not null,   -- item_open, place_open, search_miss...
  props      jsonb,                  -- {"kind":"prophet","id":"eliyahu"}
  path       text,                   -- / | /atlas | /places
  session    text,                   -- מזהה אקראי לביקור, מת עם הטאב
  ref        text,                   -- הדומיין שממנו הגיעו (לא הכתובת המלאה)
  device     text,                   -- mobile | desktop

  -- שער ציבורי פתוח לכתיבה צריך גבולות. אלה לא מונעים ספאם מכוון,
  -- אבל הם מונעים משורה בודדת לתפוח בלי גבול.
  constraint site_events_name_len  check (char_length(name) <= 40),
  constraint site_events_props_len check (props is null or pg_column_size(props) < 2000)
);

create index if not exists site_events_name_idx on site_events (name, created_at desc);
create index if not exists site_events_day_idx  on site_events (created_at desc);
-- לשאילתות על התוכן של props, למשל "אילו דמויות נפתחו הכי הרבה"
create index if not exists site_events_props_idx on site_events using gin (props);

-- כתיבה בלבד: הדפדפן מוסיף שורות ולעולם לא קורא אותן. אין policy ל-select,
-- ולכן אף אחד לא יכול לשלוף מכאן דבר עם המפתח הציבורי - כולל את מה שהוא
-- עצמו כתב. הקריאה נעשית כאן, ב-SQL Editor, שרץ מעל RLS.
alter table site_events enable row level security;

drop policy if exists site_events_insert on site_events;
create policy site_events_insert on site_events for insert to anon with check (true);

-- ההרשאות המפורשות: בלי USAGE על הרצף, הוספת שורה עם bigserial נכשלת
-- אצל anon גם כשה-policy מאשרת אותה.
grant insert on site_events to anon;
grant usage, select on sequence site_events_id_seq to anon;

-- ============================================================================
--  השאילתות שבשבילן זה נבנה
-- ============================================================================
-- הדמויות הנצפות ביותר:
--   select props->>'kind' as kind, props->>'id' as id, count(distinct session) as people
--     from site_events where name = 'item_open'
--    group by 1,2 order by people desc limit 20;
--
-- המקומות הנצפים ביותר:
--   select props->>'id' as place, count(distinct session) as people
--     from site_events where name = 'place_open'
--    group by 1 order by people desc limit 20;
--
-- מה חיפשו ולא מצאו - רשימת התוכן שחסר באתר:
--   select props->>'q' as query, count(*) from site_events
--    where name = 'search_miss' group by 1 order by 2 desc limit 30;
--
-- באיזה מבט בוחרים במסך הפתיחה:
--   select props->>'view' as view, count(*) from site_events
--    where name = 'view_chosen' group by 1 order by 2 desc;
--
-- עד לאיזו תקופה מגיעים במסע הדורות:
--   select props->>'era' as era, count(distinct session) as people
--     from site_events where name = 'era_reached' group by 1 order by people desc;
--
-- מכשיר, מקור תנועה, ושימוש בפיצ'רים:
--   select device, count(distinct session) from site_events group by 1;
--   select coalesce(ref,'ישיר') as source, count(distinct session)
--     from site_events group by 1 order by 2 desc limit 20;
--   select name, count(distinct session) as people from site_events
--    where name in ('tree_open','tours_open','guide_open','map_open')
--    group by 1 order by people desc;
--
-- ניקוי שורות בדיקה:
--   delete from site_events where session = 'test';
