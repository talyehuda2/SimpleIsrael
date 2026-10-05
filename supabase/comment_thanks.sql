-- ============================================================================
--  "♥ תודה" על תגובה
--  להריץ ב-Supabase: SQL Editor -> New query -> הדבקה -> Run. בטוח לחזרה.
--
--  המבנה:
--    comment_thanks  - שורה לכל (תגובה, מכשיר). המפתח הראשי הוא הזוג, ולכן
--                      מכשיר אחד נותן לכל היותר תודה אחת לכל תגובה.
--                      אין לה שום גישה מהדפדפן - לא קריאה ולא כתיבה.
--    comments.thanks - הספירה עצמה, עמודה רגילה שנקראת יחד עם התגובות,
--                      בלי בקשה נוספת. רק הפונקציה למטה כותבת אליה.
--    thank_comment   - הדרך היחידה להוסיף או לבטל תודה. security definer,
--                      ומחזירה את הספירה החדשה.
--
--  "מכשיר" הוא מזהה אקראי שנוצר בדפדפן ונשמר בו (si_voter) - לא אדם ולא
--  כתובת IP. מי שמנקה את הדפדפן יכול לתת תודה שוב; זה מחיר מקובל לכפתור
--  שאין בו אינטרס כספי. נגד סקריפט שמנפח: מכסה של 30 לדקה למכשיר, ו-300
--  לדקה לכל האתר יחד.
-- ============================================================================

alter table comments add column if not exists thanks int not null default 0;
grant select (thanks) on comments to anon, authenticated;

create table if not exists comment_thanks (
  comment_id bigint      not null references comments(id) on delete cascade,
  voter      text        not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, voter)
);
create index if not exists comment_thanks_created_idx on comment_thanks (created_at desc);

-- הספירה נכתבת רק מתוך thank_comment. גולש שמוסיף תגובה עם thanks=500,
-- או מעדכן שורה קיימת (אם אי-פעם תינתן הרשאת עדכון) - מאופס. אותו דפוס של
-- comments_guard_admin ב-admin_badge.sql, ומאותה סיבה הפונקציה אינה
-- security definer: הזיהוי הוא לפי current_user.
create or replace function comments_guard_thanks()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.thanks := case when tg_op = 'UPDATE' then old.thanks else 0 end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_guard_thanks on comments;
create trigger on_comment_guard_thanks
  before insert or update on comments
  for each row execute function comments_guard_thanks();

-- RLS דלוק ובלי אף policy: הדפדפן לא קורא ולא כותב בטבלה ישירות
alter table comment_thanks enable row level security;
revoke all on comment_thanks from anon, authenticated;

create or replace function thank_comment(p_comment bigint, p_voter text, p_on boolean default true)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_n   int;
begin
  if p_voter is null or p_voter !~ '^[a-z0-9-]{8,40}$' then
    raise exception 'מזהה לא תקין';
  end if;

  select target_key into v_key from comments where id = p_comment;
  -- פניות פרטיות (admin:...) אינן תגובות, ואין עליהן תודה
  if v_key is null or lower(v_key) like 'admin:%' then
    raise exception 'התגובה לא נמצאה';
  end if;

  if p_on then
    if (select count(*) from comment_thanks
         where voter = p_voter and created_at > now() - interval '1 minute') >= 30
       or (select count(*) from comment_thanks
         where created_at > now() - interval '1 minute') >= 300 then
      raise sqlstate 'PT429' using message = 'יותר מדי בזמן קצר. נסו שוב בעוד דקה.';
    end if;
    insert into comment_thanks (comment_id, voter) values (p_comment, p_voter)
      on conflict do nothing;
  else
    delete from comment_thanks where comment_id = p_comment and voter = p_voter;
  end if;

  -- סופרים מחדש ולא מוסיפים 1: כך הספירה נכונה גם אחרי לחיצה כפולה
  select count(*) into v_n from comment_thanks where comment_id = p_comment;
  update comments set thanks = v_n where id = p_comment;
  return v_n;
end;
$$;

grant execute on function thank_comment(bigint, text, boolean) to anon, authenticated;
