-- מכולת (grocery store) info: a single configurable record the admin edits.
-- It can show either free text (e.g. opening hours) or an uploaded PDF; `mode`
-- picks which. Both are stored so the admin can toggle between them freely.
create table if not exists store_info (
  id boolean primary key default true, -- singleton: exactly one row (id = true)
  menu_label text not null default 'מכולת',
  mode text not null default 'text' check (mode in ('text', 'pdf')),
  body text not null default '',
  file_path text, -- storage key in the 'community' bucket (PDF mode)
  file_name text,
  updated_at timestamptz not null default now(),
  constraint store_info_singleton check (id = true)
);

insert into store_info (id) values (true) on conflict (id) do nothing;

-- Content is community info shown to signed-in users. The app reads it with the
-- service role, but allow plain reads too; writes go only through the service
-- role (no insert/update/delete policy).
alter table store_info enable row level security;
drop policy if exists store_info_read on store_info;
create policy store_info_read on store_info for select using (true);
