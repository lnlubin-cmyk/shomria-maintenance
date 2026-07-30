-- =====================================================================
-- building_facts — arbitrary [key, value] notes staff keep per house, e.g.
-- key="קוטר צינור", value="18". Stored against the house ID (plot_number).
-- Relational child table (one row per fact) — no separate NoSQL store needed.
-- Staff-only: shown to staff when viewing/updating a call for that house.
-- =====================================================================
create table if not exists building_facts (
  id                  uuid primary key default uuid_generate_v4(),
  plot_number         text not null references buildings (plot_number) on delete cascade,
  key                 text not null,
  value               text not null default '',
  created_by_user_id  uuid references users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table building_facts is 'מידע שימושי (מפתח/ערך) שצוות התחזוקה שומר לכל בית.';

create index if not exists building_facts_plot_idx on building_facts (plot_number, created_at);

alter table building_facts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'building_facts' and policyname = 'building_facts_staff_all') then
    create policy building_facts_staff_all on building_facts
      for all to authenticated using (is_staff()) with check (is_staff());
  end if;
end $$;

drop trigger if exists building_facts_updated_at on building_facts;
create trigger building_facts_updated_at before update on building_facts
  for each row execute function set_updated_at();
