-- =====================================================================
-- Community ("קהילה") — admin-managed menu items, each a subject + a PDF.
--
-- Admins add/edit/hide items from the management page with no deploy. A menu
-- item appears only when it has a subject AND a file AND is toggled visible;
-- that condition is enforced when building the menu, and defense-in-depth here
-- via RLS. Files live in a private Storage bucket; the app serves them to
-- logged-in users through short-lived signed URLs.
-- =====================================================================

create table if not exists community_items (
  id          uuid primary key default uuid_generate_v4(),
  subject     text not null default '',        -- menu label, e.g. "הידיעון האחרון"
  file_path   text,                             -- storage key in the 'community' bucket
  file_name   text,                             -- original filename, for display/download
  is_visible  boolean not null default false,   -- present/hide toggle
  sort_order  integer not null default 0,       -- menu order (lower first)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table community_items is 'פריטי מדור „קהילה” — נושא + קובץ PDF, בניהול אדמין.';

create index if not exists community_items_visible_idx on community_items (is_visible, sort_order);

-- ---------------------------------------------------------------------
-- RLS: authenticated may read only visible items; only admin writes.
-- (The menu/list is built server-side with the service role, but keep the
-- table safe if ever read through a user client.)
-- ---------------------------------------------------------------------
alter table community_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'community_items' and policyname = 'community_select_visible') then
    create policy community_select_visible on community_items
      for select to authenticated using (is_visible = true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'community_items' and policyname = 'community_admin_all') then
    create policy community_admin_all on community_items
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists community_items_updated_at on community_items;
create trigger community_items_updated_at
  before update on community_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Private Storage bucket for the PDFs (PDF only, 20MB cap). Access is via
-- server-generated signed URLs; the service-role client bypasses storage RLS,
-- so no object policies are needed.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;
