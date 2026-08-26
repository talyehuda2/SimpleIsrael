-- ============================================================================
--  שדה יצירת קשר בפניות למנהל
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  עד שזה רץ, טופס "הערה למנהל" עובד כרגיל - אבל פנייה שמולא בה מייל
--  או טלפון תיכשל, כי PostgREST דוחה עמודה שאינה קיימת.
-- ============================================================================

alter table comments add column if not exists contact text;

-- ההרשאה החשובה: אנונימי יכול *לכתוב* את השדה אבל לא *לקרוא* אותו.
-- הרשאה ברמת עמודה גוברת על כל policy של RLS, ולכן זה מחזיק גם אם יום
-- אחד ישמרו כאן כתובות מייל של מגיבים רגילים - שהתגובות שלהם ציבוריות.
-- (שתי השאילתות של Comments.jsx בוררות עמודות במפורש ולא select *,
--  ולכן השלילה הזו לא שוברת שום קריאה קיימת.)
revoke select (contact) on comments from anon;
revoke select (contact) on comments from authenticated;

-- לקריאת הפניות עם פרטי הקשר:
--   select created_at, author, contact, body from comments
--    where target_key = 'admin:notes' order by created_at desc;
