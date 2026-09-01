-- ============================================================================
--  מחיקת פניות פרטיות שנה לאחר שטופלו
--
--  למה זה קיים: מדיניות הפרטיות ב-/privacy מצהירה ש"פניות פרטיות נמחקות
--  שנה לאחר שטופלו". הצהרה שאינה מקוימת גרועה מהעדר הצהרה - היא מתארת
--  לרשות ולגולש נוהל שלא קיים. הקובץ הזה הוא הנוהל עצמו.
--
--  מה נמחק: רק שורות עם target_key='admin:notes' שכבר סומנו כטופלו
--  (handled_at אינו null) ושעברה שנה מאז. תגובות פומביות אינן נמחקות -
--  הן חלק מהתוכן שגולשים אחרים קוראים, ומחיקתן היא לבקשה בלבד.
--
--  למה davka handled_at ולא created_at: פנייה שלא טופלה עדיין ממתינה
--  לתשובה, ומחיקה שלה היא בדיוק ההפך ממה שהכותב ביקש כשהשאיר כתובת.
--
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--  תלוי ב-admin_inbox.sql (העמודה handled_at) וב-contact_column.sql.
-- ============================================================================

create or replace function purge_old_admin_notes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from comments
   where target_key = 'admin:notes'
     and handled_at is not null
     and handled_at < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- הפונקציה אינה נחשפת לדפדפן: אין כאן grant ל-anon, בכוונה. היא רצה רק
-- מתוך התזמון שלמטה, או ידנית מ-SQL Editor.
revoke execute on function purge_old_admin_notes() from anon, authenticated;

-- ----------------------------------------------------------------------------
--  התזמון. pg_cron הוא הרחבה שיש להפעיל פעם אחת בפרויקט:
--  Dashboard -> Database -> Extensions -> pg_cron -> Enable
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- כל יום ראשון ב-03:00 UTC. שבועי ולא יומי כי המחיקה היא לפי גיל של שנה,
-- ויום או שניים של הפרש אינם משנים - אבל ריצה נדירה קלה יותר לניטור.
select cron.unschedule('purge-admin-notes')
 where exists (select 1 from cron.job where jobname = 'purge-admin-notes');

select cron.schedule(
  'purge-admin-notes',
  '0 3 * * 0',
  $$select purge_old_admin_notes()$$
);

-- ----------------------------------------------------------------------------
--  בדיקה ידנית לפני שסומכים על התזמון:
--
--    -- כמה שורות היו נמחקות עכשיו:
--    select count(*) from comments
--     where target_key = 'admin:notes'
--       and handled_at is not null
--       and handled_at < now() - interval '1 year';
--
--    -- הרצה בפועל, מחזירה כמה נמחקו:
--    select purge_old_admin_notes();
--
--    -- מתי התזמון רץ לאחרונה:
--    select * from cron.job_run_details
--     where jobid = (select jobid from cron.job where jobname = 'purge-admin-notes')
--     order by start_time desc limit 5;
-- ----------------------------------------------------------------------------
