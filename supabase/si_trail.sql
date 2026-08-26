-- ============================================================================
--  אירועי שימוש באתר
--
--  השם si_trail ולא site_events בכוונה: חוסמי פרסומות מסננים לפי תבנית
--  בנתיב הבקשה, והמילה events היא אחת מהן. אותה סיבה בדיוק שבגללה קובץ
--  המקור נקרא trail.js ולא analytics.js.
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  למה כאן ולא ב-Vercel: אירועים מותאמים אינם נתמכים בחבילת Hobby, וגם
--  ב-Pro הם מוגבלים לשני מאפיינים לאירוע ולחלון דיווח של שנה. כאן אין
--  הגבלה, אין תפוגה, והנתונים שלך.
--  צפיות העמוד נשארות ב-Vercel - הן חינם ומגיעות עם מדינה ומכשיר.
-- ============================================================================

create table if not exists si_trail (
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
  constraint si_trail_name_len  check (char_length(name) <= 40),
  constraint si_trail_props_len check (props is null or pg_column_size(props) < 2000)
);

create index if not exists si_trail_name_idx on si_trail (name, created_at desc);
create index if not exists si_trail_day_idx  on si_trail (created_at desc);
-- לשאילתות על התוכן של props, למשל "אילו דמויות נפתחו הכי הרבה"
create index if not exists si_trail_props_idx on si_trail using gin (props);

-- כתיבה בלבד: הדפדפן מוסיף שורות ולעולם לא קורא אותן. אין policy ל-select,
-- ולכן אף אחד לא יכול לשלוף מכאן דבר עם המפתח הציבורי - כולל את מה שהוא
-- עצמו כתב. הקריאה נעשית כאן, ב-SQL Editor, שרץ מעל RLS.
alter table si_trail enable row level security;

drop policy if exists si_trail_insert on si_trail;
create policy si_trail_insert on si_trail for insert to anon with check (true);

-- ההרשאות המפורשות: בלי USAGE על הרצף, הוספת שורה עם bigserial נכשלת
-- אצל anon גם כשה-policy מאשרת אותה.
grant insert on si_trail to anon;
grant usage, select on sequence si_trail_id_seq to anon;

-- ============================================================================
--  השאילתות שבשבילן זה נבנה
-- ============================================================================
-- הדמויות הנצפות ביותר:
--   select props->>'kind' as kind, props->>'id' as id, count(distinct session) as people
--     from si_trail where name = 'item_open'
--    group by 1,2 order by people desc limit 20;
--
-- המקומות הנצפים ביותר:
--   select props->>'id' as place, count(distinct session) as people
--     from si_trail where name = 'place_open'
--    group by 1 order by people desc limit 20;
--
-- מה חיפשו ולא מצאו - רשימת התוכן שחסר באתר:
--   select props->>'q' as query, count(*) from si_trail
--    where name = 'search_miss' group by 1 order by 2 desc limit 30;
--
-- באיזה מבט בוחרים במסך הפתיחה:
--   select props->>'view' as view, count(*) from si_trail
--    where name = 'view_chosen' group by 1 order by 2 desc;
--
-- עד לאיזו תקופה מגיעים במסע הדורות:
--   select props->>'era' as era, count(distinct session) as people
--     from si_trail where name = 'era_reached' group by 1 order by people desc;
--
-- מכשיר, מקור תנועה, ושימוש בפיצ'רים:
--   select device, count(distinct session) from si_trail group by 1;
--   select coalesce(ref,'ישיר') as source, count(distinct session)
--     from si_trail group by 1 order by 2 desc limit 20;
--   select name, count(distinct session) as people from si_trail
--    where name in ('tree_open','tours_open','guide_open','map_open')
--    group by 1 order by people desc;
--
-- תנועה יומית - ספירה שלנו, בלתי-תלויה בסקריפט של Vercel שנחסם אצל חלק:
--   select date(created_at) as day, path, count(distinct session) as visits
--     from si_trail where name = 'page_view' group by 1,2 order by 1 desc, 3 desc;
--
-- ניקוי שורות בדיקה:
--   delete from si_trail where session = 'test';
