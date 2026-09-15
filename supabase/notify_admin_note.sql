-- ============================================================================
--  התראה מסווגת על פנייה חדשה למנהל
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run
--
--  הצורך: ההתראה הקודמת אמרה שיש פנייה, ולא מה יש בה. הפער אינו אורך
--  אלא סיווג - "זו בקשת הסרה, שעון 14 הימים התחיל" מול "זו הצעת תיקון
--  לתאריך". זה מה שקובע אם לעצור הכל או לקרוא בערב.
--
--  הזרימה, ולמה היא מפוצלת לשניים:
--
--    INSERT -> trg_notify_admin_note -> POST ל-/api/notify (Vercel)
--           -> Claude מסווג -> POST חזרה ל-push_admin_alert -> טלגרם
--
--  🔑 הסיבה לחזרה: **טוקן הטלגרם לא עוזב את Postgres.** אפשר היה
--  לתת ל-Vercel לדחוף ישירות, וזה היה חוסך קפיצה - אבל אז הטוקן היה
--  צריך לחיות כמשתנה סביבה ב-Vercel. הכלל הכי חשוב בפרויקט הוא שהטוקן
--  חי רק בגוף פונקציה כאן, וסיווג AI אינו סיבה מספיקה לשבור אותו.
--  לכן Vercel מסווג ומחזיר טקסט, ו-Postgres שולח.
--
--  ⚠️ שישה מקומות שאתה ממלא בעצמך, מסומנים ב-<<< >>>.
--     שמור את העותק הממולא כ-notify_admin_note.local.sql - הסיומת
--     מכוסה ב-.gitignore.
--
--  את טוקן הטלגרם ומזהה הצ'אט אפשר לשלוף מהפונקציה הקיימת. הטוקן אינו
--  בהכרח במשתנה נפרד - אצלנו הוא היה בתוך הכתובת עצמה, ולכן חיפוש לפי
--  "v_token" לא מצא אותו. שאילתה שמציגה רק את השורות הרלוונטיות:
--
--    select proname, line
--    from pg_proc, unnest(string_to_array(prosrc, E'\n')) as line
--    where prosrc ilike '%telegram%'
--      and (line ilike '%telegram%' or line ilike '%chat%');
--
--  ⚠️ הטוקן הוא **שני חלקים**: <מזהה הבוט>:<החלק הסודי>. שתי טעויות
--  העתקה נפוצות, ושתיהן מחזירות מטלגרם 404 Not Found:
--    - לקחת רק את מה שאחרי הנקודתיים (אורך 35 במקום 46)
--    - לקחת גם את המילה 'bot' מהכתובת (הפונקציה מוסיפה אותה בעצמה)
--  404 הוא תמיד הטוקן. מזהה צ'אט שגוי מחזיר 400 chat not found.
--
--  כדי לא להעתיק ביד בכלל - בסוף הקובץ יש בלוק שמעתיק את הטוקן
--  אוטומטית מהפונקציה הישנה שכבר עובדת.
--
--  NOTIFY_SECRET הוא מחרוזת אקראית שאתה ממציא, והיא חייבת להיות זהה
--  כאן ובמשתני הסביבה של Vercel. לייצר אחת: select gen_random_uuid();
--
--  תלוי ב-contact_column.sql (העמודה contact) ובהרחבת pg_net.
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- ----------------------------------------------------------------------------
--  1. הדחיפה בפועל. נקראת מ-Vercel אחרי הסיווג.
--
--  security definer כדי שתוכל להחזיק את הטוקן; p_secret כדי שלא כל מי
--  שמכיר את הכתובת יוכל להציף לך את הטלפון. המפתח הציבורי של Supabase
--  מספיק כדי להגיע לכאן - מה שמגן זה הסוד, לא המפתח.
-- ----------------------------------------------------------------------------
create or replace function push_admin_alert(p_secret text, p_text text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text := '<<<NOTIFY_SECRET>>>';
  v_token  text := '<<<TELEGRAM_BOT_TOKEN>>>';
  v_chat   text := '<<<TELEGRAM_CHAT_ID>>>';
  /* המייל אינו תוספת נוחות. הפונקציה הישנה notify_new_comment שלחה גם
     טלגרם וגם מייל, והצמצום שלה לתגובות ציבוריות בלבד (ראה למטה) כיבה
     את המייל על פניות פרטיות. כאן הוא חוזר - ועם הטקסט המסווג, שעדיף
     על הנוסח הגנרי שהיה. את המפתח אפשר לשלוף מ-notify_new_comment. */
  v_key    text := '<<<RESEND_API_KEY>>>';
  v_from   text := '<<<כתובת השולח, למשל SimpleIsrael <onboarding@resend.dev>>>>';
  v_to     text := '<<<תיבת המייל שלך>>>';
begin
  if p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'chat_id',                  v_chat,
      'text',                     p_text,
      'parse_mode',               'HTML',
      'disable_web_page_preview', true)
  );

  /* בלוק נפרד במכוון: אם Resend נופלת, הטלגרם כבר יצא. שתי דרכים
     עצמאיות להגיע אליך, ולא שרשרת שנקרעת בחוליה אחת.
     שורת הנושא היא השורה הראשונה של ההתראה בלי תגיות - כלומר
     הקטגוריה והדחיפות, שנראות ברשימת המיילים בלי לפתוח. */
  begin
    perform net.http_post(
      url     := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
                   'Authorization', 'Bearer ' || v_key,
                   'Content-Type',  'application/json'),
      body    := jsonb_build_object(
        'from',    v_from,
        'to',      jsonb_build_array(v_to),
        'subject', regexp_replace(split_part(p_text, chr(10), 1), '<[^>]+>', '', 'g'),
        'html',    '<div dir="rtl" style="font-family:system-ui,Arial,sans-serif;line-height:1.7;color:#222">'
                   || replace(p_text, chr(10), '<br>') || '</div>')
    );
  exception when others then
    raise warning 'push_admin_alert mail failed: % / %', sqlstate, sqlerrm;
  end;
end;
$$;

-- anon אכן מורשה לקרוא - זו הדרך שבה Vercel מגיע לכאן. ההגנה היא הסוד
-- שבגוף הפונקציה, ולכן אין כאן חשיפה של הטוקן לאף אחד.
grant execute on function push_admin_alert(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
--  2. הטריגר. שולח את הפנייה לסיווג.
-- ----------------------------------------------------------------------------
create or replace function notify_admin_note()
returns trigger
language plpgsql
security definer                 -- נדרש: contact נשללה מ-anon, והטריגר
set search_path = public, extensions   -- חייב לקרוא אותה כדי לצרף אותה
as $$
declare
  v_secret text := '<<<NOTIFY_SECRET>>>';
begin
  perform net.http_post(
    url     := 'https://simpleisrael.co.il/api/notify',
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'x-notify-secret',  v_secret),
    body    := jsonb_build_object(
      'id',      new.id,
      'author',  new.author,
      'body',    new.body,
      'contact', new.contact)
  );
  return new;
exception when others then
  /* פנייה שנכתבה חייבת להישמר גם אם ההתראה נכשלה - ולכן בולעים. אבל
     בליעה שקטה משאירה אותך בלי עקבות כשלא מגיעה התראה, ולכן הכישלון
     נרשם. Supabase -> Logs -> Postgres, חיפוש notify_admin_note. */
  raise warning 'notify_admin_note failed: % / %', sqlstate, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_admin_note on comments;
create trigger trg_notify_admin_note
  after insert on comments
  for each row
  when (new.target_key = 'admin:notes')
  execute function notify_admin_note();

-- ----------------------------------------------------------------------------
--  ⚠️ הכפילות אינה אפשרות - היא קרתה. אומת בייצור ב-14.9.2026:
--  הטריגר הישן, on_new_comment, הוגדר בלי שום תנאי ולכן ירה גם על
--  פניות פרטיות. התוצאה הייתה שתי הודעות טלגרם על אותה פנייה.
--
--  התיקון - צמצום דרך תנאי הטריגר בלבד. גוף notify_new_comment לא
--  נוגעים בו, כי טוקן הטלגרם יושב בתוכו ואין סיבה לסכן אותו:
--
--    drop trigger if exists on_new_comment on public.comments;
--    create trigger on_new_comment
--      after insert on public.comments
--      for each row
--      when (new.target_key is distinct from 'admin:notes')
--      execute function notify_new_comment();
--
--  ⚠️ לפני שמצמצמים - לוודא שהפונקציה הישנה אינה עושה עוד משהו מלבד
--  טלגרם. אם היא שולחת גם מייל, הצמצום מכבה גם אותו, ובשקט:
--
--    select proname, prosrc ilike '%resend%' as mail,
--           prosrc ilike '%telegram%' as telegram
--    from pg_proc where proname = 'notify_new_comment';
--
--  is distinct from ולא <>: השוואה רגילה מול NULL מחזירה "לא ידוע",
--  ולכן תגובה עם target_key ריק הייתה מפסיקה לייצר התראה בשקט. זו
--  בדיוק תקלה שלא מתגלה - מפסיקים לקבל חלק מההתראות בלי לדעת.
--
--  אם שם הטריגר אצלך שונה:
--    select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where not tgisinternal and tgfoid = 'notify_new_comment'::regproc;
--
--  בדיקה מקצה לקצה, בלי לחכות לגולש אמיתי. שתי השורות, וכל אחת
--  צריכה לייצר הודעה אחת בלבד - הראשונה את המסווגת, השנייה את הישנה:
--
--    insert into comments (target_key, target_label, author, body, contact)
--    values ('admin:notes', '📋 בדיקה', 'בדיקה',
--            'שלום, יש טעות בתאריך של שמואל הנביא', 'test@example.com');
--
--    insert into comments (target_key, target_label, author, body)
--    values ('event:churban1', 'חורבן בית ראשון', 'בדיקה',
--            'תגובת בדיקה - למחוק');
--
--  השנייה מופיעה באתר החי כתגובה אמיתית - למחוק אותה מ-/admin מיד.
--  שווה לבדוק גם אותה: טעות בתנאי הטריגר משתיקה התראות על תגובות
--  אמיתיות, ובלי בדיקה מפורשת אי אפשר לדעת שזה קרה.
--
--  ✉️ המייל הגיע לספאם, ולא נעלם. Resend החזירה 200 עם מזהה הודעה -
--  כלומר "קיבלתי ושלחתי", שאינו "הגיע לתיבה". שורת נושא חדשה שמתחילה
--  באימוג'י, משולחת בדומיין המשותף resend.dev, היא בדיוק מה שמסננים
--  תופסים. הסטטוס האמיתי נמצא ב-resend.com -> Emails, לא כאן.
--
--  התיקון הנכון הוא לאמת את simpleisrael.co.il ב-Resend ולשלוח
--  מ-noreply@simpleisrael.co.il. onboarding@resend.dev היא כתובת חול
--  ועוברת סינון גרוע, ולכן האימות שווה את המאמץ - כשדרוג, לא כתיקון.
--
--  חששנו שהמגבלה של כתובת החול - שליחה לבעל החשבון בלבד - חוסמת גם
--  את notify_comment_reply, ששולחת לגולשים. **זה נבדק ונשלל:** שתי
--  כתובות שונות כבר קיבלו מיילים מהחשבון הזה, ותחת המגבלה רק אחת
--  הייתה עוברת. נרשם כאן כדי שלא ייחקר שוב מאפס.
--
--  ⏱ שתי שורות עם Timeout of 5000 ms ביומן הן תקינות. זו הקריאה
--  ל-/api/notify: pg_net מוותר על ההמתנה אחרי חמש שניות, והסיווג
--  לוקח יותר. Vercel קיבל, סיווג והחזיר - ההתראה עצמה היא ההוכחה.
--  פשוט אין מי שיקשיב לתשובה בצד הזה של הקו.
--
--  אם לא הגיעה התראה, כאן רואים בדיוק איפה נעצר:
--    select id, created, status_code, left(content, 300)
--    from net._http_response order by created desc limit 5;
--
--    500 - Vercel לא רואה את NOTIFY_SECRET (חסר Redeploy אחרי הוספתו,
--          או שהמשתנה הוגדר ברמת הצוות ולא קושר לפרויקט)
--    403 - הסודות אינם זהים בין Vercel ל-SQL
--    404 - מטלגרם: הטוקן. מ-Vercel: הפונקציה לא נפרסה
--    400 - chat not found, כלומר מזהה הצ'אט
--    200 - הכל עבר; אם אין הודעה, לבדוק שהטלגרם לא מושתק
--
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
--  נספח: לתקן את הטוקן בלי להעתיק אותו ביד
--
--  זה מה שפתר את התקלה בפועל. הבלוק שולף את הטוקן מהפונקציה הישנה -
--  זו ששולחת התראות מזה חודשים, כלומר טוקן שמוכח שעובד - ובונה איתו
--  מחדש את push_admin_alert. הסוד ומזהה הצ'אט נשמרים כפי שהם.
--
--  להריץ רק אם כבר הרצת את הקובץ פעם אחת ומשהו בטוקן שגוי.
-- ----------------------------------------------------------------------------
/*
do $do$
declare
  v_tok text; v_sec text; v_cht text;
begin
  select coalesce(
           substring(prosrc from 'bot([0-9]{6,}:[A-Za-z0-9_-]{30,})'),
           substring(prosrc from '''([0-9]{6,}:[A-Za-z0-9_-]{30,})''')
         ) into v_tok
  from pg_proc where proname = 'notify_new_comment';

  select substring(prosrc from 'v_secret\s+text\s*:=\s*''([^'']*)'''),
         substring(prosrc from 'v_chat\s+text\s*:=\s*''([^'']*)''')
    into v_sec, v_cht
  from pg_proc where proname = 'push_admin_alert';

  if v_tok is null then raise exception 'לא נמצא טוקן בפונקציה הישנה'; end if;
  if coalesce(v_sec,'') = '' then raise exception 'לא נמצא הסוד'; end if;
  if coalesce(v_cht,'') = '' then raise exception 'לא נמצא מזהה הצאט'; end if;

  execute format($f$
create or replace function push_admin_alert(p_secret text, p_text text)
returns void language plpgsql security definer
set search_path = public, extensions
as $body$
declare
  v_secret text := %L;
  v_token  text := %L;
  v_chat   text := %L;
begin
  if p_secret is distinct from v_secret then
    raise exception 'unauthorized';
  end if;
  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'chat_id', v_chat, 'text', p_text,
      'parse_mode', 'HTML', 'disable_web_page_preview', true)
  );
end;
$body$;
$f$, v_sec, v_tok, v_cht);

  raise notice 'תוקן. אורך הטוקן החדש: %', length(v_tok);
end
$do$;
*/
