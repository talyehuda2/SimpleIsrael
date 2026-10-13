-- ============================================================================
--  עריכת תגובה שנכתבה כמנהל - כפתור "עריכה" במסך הניהול
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  עד היום אפשר היה רק למחוק תגובה ולכתוב חדשה. באוקטובר 2026 בעל האתר רצה
--  להשלים תשובה לגולש (שבע הברכות בלך לך), ונאלץ לעשות את זה ב-SQL Editor.
--
--  רק תגובה עם by_admin = true - כלומר שנשלחה ממסך הניהול או מהכרטיס עם טוקן.
--  תגובה של גולש לא נערכת: מה שכתוב תחת השם שלו הוא מה שהוא כתב. מחיקה
--  נשארת כמו שהייתה. פנייה פרטית (admin:notes) אינה תגובה ואינה נערכת.
--
--  עריכה לא שולחת מייל ולא התראה: הטריגרים של ההתראות רצים על insert בלבד.
--
--  אין כאן מקום לטוקן: הוא נשלף מ-admin_inbox הקיימת, כמו ב-admin_badge.sql.
-- ============================================================================

do $do$
declare
  tok text;
begin
  select substring(prosrc from $re$p_token <> '([^']+)'$re$) into tok
    from pg_proc where proname = 'admin_inbox' limit 1;
  if tok is null or tok like '<<<%' then
    raise exception 'לא נמצא טוקן ב-admin_inbox. קודם להריץ את admin_inbox.sql עם הטוקן.';
  end if;

  execute format($f$
create or replace function admin_edit_comment(p_token text, p_id bigint, p_body text)
returns table (id bigint, body text)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if p_token is null or p_token <> %L then
    raise exception 'טוקן ניהול שגוי';
  end if;
  if v_body = '' or length(v_body) > 1000 then
    raise exception 'תוכן ריק או ארוך מדי';
  end if;

  return query
    update comments as c set body = v_body
     where c.id = p_id and c.by_admin
       and lower(coalesce(c.target_key, '')) not like 'admin:%%'
    returning c.id, c.body;
  if not found then
    raise exception 'אפשר לערוך רק תגובה שנכתבה כמנהל';
  end if;
end;
$body$;
$f$, tok);
end
$do$;

revoke all on function admin_edit_comment(text, bigint, text) from public;
grant execute on function admin_edit_comment(text, bigint, text) to anon, authenticated;
