-- ============================================================================
--  הגבלת קצב על כתיבת תגובות ופניות
--
--  למה זה קיים: מדיניות ה-INSERT מאמתת את *צורת* השורה - מלכודת הדבש
--  ריקה, גוף באורך 1 עד 1000, שם עד 40 - אך לא את *הכמות*. מפתח
--  ה-publishable ציבורי בכוונה, ולכן אפשר להזרים איתו שורות בלי גבול.
--
--  ומה שהופך את זה מטרדן למסוכן: כל שורה עם target_key='admin:notes'
--  מפעילה את on_new_admin_note, שקורא ל-Vercel לסיווג ושולח טלגרם ומייל.
--  הצפה של חמשת אלפים פניות היא חמשת אלפים קריאות סיווג וחמשת אלפים
--  הודעות. NOTIFY_SECRET מגן על הקצה מבחוץ, אבל הטריגר יוצא מבפנים
--  ואינו עובר דרכו.
--
--  ⚠️ security definer כאן אינו הידור אלא תנאי לתפקוד. בלעדיו הפונקציה
--  רצה בהרשאות anon, ומדיניות הקריאה מסתירה מ-anon את שורות admin:notes.
--  התוצאה הייתה count=0 תמיד, והמגבלה לא הייתה נכנסת לפעולה לעולם -
--  בשקט, בלי שגיאה, בדיוק במקרה שבגללו נכתבה.
--
--  מה זה לא עושה: אין במסד כתובת IP, ולכן אי אפשר להגביל לפי כותב.
--  הספירה היא גלובלית, ומכאן הפשרה: תוקף שמציף *יכול* לחסום כותב
--  אמיתי לדקה. לכן המגבלות רחבות מספיק כדי שמשתמש אמיתי לא יגיע
--  אליהן אף פעם, והתועלת היא תקרה - במקום אלפי הודעות בשנייה, חמש
--  בדקה. זו הפחתת נזק, לא חסימה.
--
--  להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--  תלוי ב-notify_admin_note.sql (הטריגר שאותו זה מגן).
-- ============================================================================

-- הספירה רצה על כל הוספה, ולכן צריכה אינדקס. בלעדיו זו סריקה מלאה.
create index if not exists comments_created_at_idx on comments (created_at desc);

create or replace function comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin   boolean := lower(coalesce(new.target_key, '')) like 'admin:%';
  v_limit   integer := case when v_admin then 5 else 20 end;  -- לדקה
  v_recent  integer;
  v_dup     integer;
begin
  -- שער ראשון: כמות בדקה האחרונה, באותה משפחה (פניות מול תגובות)
  select count(*) into v_recent
    from comments
   where created_at > now() - interval '1 minute'
     and (lower(coalesce(target_key, '')) like 'admin:%') = v_admin;

  if v_recent >= v_limit then
    raise sqlstate 'PT429'
      using message = 'יותר מדי פניות בזמן קצר. נסו שוב בעוד דקה.';
  end if;

  -- שער שני: אותו טקסט בדיוק, לאותו יעד, בעשר הדקות האחרונות.
  -- זה תופס את הסקריפט שחוזר על עצמו, ומשתמש אמיתי כמעט לא נתקל בו.
  select count(*) into v_dup
    from comments
   where created_at > now() - interval '10 minutes'
     and coalesce(target_key, '') = coalesce(new.target_key, '')
     and body = new.body;

  if v_dup > 0 then
    raise sqlstate 'PT429'
      using message = 'ההודעה הזאת כבר נשלחה. אם לא הגיעה, נסו שוב בעוד כמה דקות.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_rate_limit on comments;
create trigger on_comment_rate_limit
  before insert on comments
  for each row execute function comments_rate_limit();

-- הערה על PT429: זה המנגנון של PostgREST להחזרת קוד HTTP מתוך שגיאת
-- Postgres, והגולש יקבל 429 עם ההודעה בעברית. אם גרסת PostgREST אינה
-- תומכת, ההוספה עדיין נדחית - וזה העיקר. רק הקוד יהיה 500 במקום 429.

-- ----------------------------------------------------------------------------
-- אימות אחרי ההרצה. השורה השישית אמורה להיכשל, והראשונות לעבור:
--
--   do $t$ begin
--     for i in 1..6 loop
--       insert into comments (target_key, body) values ('admin:notes', 'בדיקה ' || i);
--     end loop;
--   end $t$;
--
-- ולבדיקת שער הכפילות:
--   insert into comments (target_key, body) values ('leader:avraham', 'שלום');
--   insert into comments (target_key, body) values ('leader:avraham', 'שלום');  -- ייכשל
--
-- ניקוי אחרי הבדיקה:
--   delete from comments where body like 'בדיקה %' or body = 'שלום';
-- ----------------------------------------------------------------------------
