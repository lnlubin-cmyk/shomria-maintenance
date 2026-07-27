-- =====================================================================
-- שיעורי תורה — Torah lessons, admin-managed. A flat, ordered list. Each lesson
-- has a subject, an occurrence (free text, e.g. "כל יום ראשון ושלישי"), and an
-- hour (free text). Admin controls order and can hide a lesson.
-- =====================================================================

create table if not exists torah_lessons (
  id          uuid primary key default uuid_generate_v4(),
  subject     text not null default '',
  occurrence  text not null default '',   -- מתי (חופשי)
  hour        text not null default '',    -- שעה (חופשי)
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table torah_lessons is 'שיעורי תורה בישוב (נושא, מועד, שעה) בניהול אדמין.';

create index if not exists torah_lessons_order_idx on torah_lessons (is_visible, sort_order, created_at);

alter table torah_lessons enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'torah_lessons' and policyname = 'torah_select_visible') then
    create policy torah_select_visible on torah_lessons for select to authenticated using (is_visible = true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'torah_lessons' and policyname = 'torah_admin_all') then
    create policy torah_admin_all on torah_lessons for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists torah_lessons_updated_at on torah_lessons;
create trigger torah_lessons_updated_at
  before update on torah_lessons
  for each row execute function set_updated_at();
