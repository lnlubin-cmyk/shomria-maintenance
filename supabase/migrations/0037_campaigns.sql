-- =====================================================================
-- קמפיינים — an image "poster" shown to a visitor once, on first entry to the
-- home page (tracked per device in the browser). Admin-managed; one active at a
-- time. Each campaign has an optional link (internal "/..." or external URL)
-- surfaced as "לפרטים הקש כאן".
-- =====================================================================

create table if not exists campaigns (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null default '',
  file_path   text,                             -- image in the 'campaigns' bucket
  file_name   text,
  link_url    text,                             -- optional; "/path" (internal) or "https://…" (external)
  is_active   boolean not null default false,   -- only one should be active at a time
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table campaigns is 'קמפיינים — מודעת תמונה שמוצגת בכניסה הראשונה לאתר.';

create index if not exists campaigns_active_idx on campaigns (is_active, created_at desc);

alter table campaigns enable row level security;

do $$
begin
  -- Everyone (incl. logged-out) may read the active campaign.
  if not exists (select 1 from pg_policies where tablename = 'campaigns' and policyname = 'campaigns_select_active') then
    create policy campaigns_select_active on campaigns for select to public using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'campaigns' and policyname = 'campaigns_admin_all') then
    create policy campaigns_admin_all on campaigns for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists campaigns_updated_at on campaigns;
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- Public bucket for the poster image (shown to logged-out visitors too). 5MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaigns', 'campaigns', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;
