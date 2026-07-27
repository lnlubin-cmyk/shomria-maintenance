-- =====================================================================
-- זמני תפילות — prayer schedules, admin-managed. Each schedule (e.g. "יום חול")
-- holds an ordered list of prayers (שחרית / מנחה / ערבית / אחר), and each prayer
-- holds an ordered list of minyanim (name, time, notes). Schedules and minyanim
-- each carry a show/hide flag. The nested prayers/minyanim are stored as JSON
-- (the whole schedule is edited and saved as one unit).
--
-- prayers jsonb shape:
--   [ { "title": "שחרית", "custom_title": "",
--       "minyanim": [ { "name": "מניין ראשון", "time": "6:00",
--                       "notes": "", "is_visible": true } ] } ]
-- =====================================================================

create table if not exists prayer_schedules (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null default '',        -- e.g. "יום חול", "שבת"
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  prayers     jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table prayer_schedules is 'זמני תפילות — לוחות תפילה (יום חול/שבת/חג) עם תפילות ומניינים.';

create index if not exists prayer_schedules_order_idx on prayer_schedules (is_visible, sort_order, created_at);

alter table prayer_schedules enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'prayer_schedules' and policyname = 'prayer_select_visible') then
    create policy prayer_select_visible on prayer_schedules for select to authenticated using (is_visible = true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'prayer_schedules' and policyname = 'prayer_admin_all') then
    create policy prayer_admin_all on prayer_schedules for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists prayer_schedules_updated_at on prayer_schedules;
create trigger prayer_schedules_updated_at
  before update on prayer_schedules
  for each row execute function set_updated_at();
