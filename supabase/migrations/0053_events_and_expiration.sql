-- =====================================================================
-- אירועים — upcoming community events, shown as an auto-advancing carousel on
-- the home page (after תורה ותפילה). Plus an optional expiration date on every
-- admin-added display item: menu items, moments and events are hidden once the
-- date passes (an item shows while today <= expires_at, or when it's null).
-- =====================================================================

-- Expiration on the existing admin-added items.
alter table community_items add column if not exists expires_at date;
alter table community_moments add column if not exists expires_at date;

comment on column community_items.expires_at is 'תאריך תפוגה — לא מוצג לאחר תאריך זה (ריק = ללא תפוגה)';
comment on column community_moments.expires_at is 'תאריך תפוגה — לא מוצג לאחר תאריך זה (ריק = ללא תפוגה)';

-- Events.
create table if not exists community_events (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null default '',
  body        text not null default '',        -- rich-text description (optional)
  event_date  date,                             -- when the event happens (optional)
  image_path  text,                             -- storage key in the 'community' bucket (optional)
  image_name  text,
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  expires_at  date,                             -- hidden after this date (optional)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table community_events is 'אירועים קרובים — כרטיסים בקרוסלה בדף הבית, בניהול אדמין.';

create index if not exists community_events_visible_idx on community_events (is_visible, sort_order);

alter table community_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'community_events' and policyname = 'events_select_visible') then
    create policy events_select_visible on community_events
      for select to authenticated using (is_visible = true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'community_events' and policyname = 'events_admin_all') then
    create policy events_admin_all on community_events
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists community_events_updated_at on community_events;
create trigger community_events_updated_at
  before update on community_events
  for each row execute function set_updated_at();
