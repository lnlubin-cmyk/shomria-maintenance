-- Generalize the מכולת singleton into reusable "info panels" keyed by slug, so
-- מכולת (store) and מרפאה (clinic) — and any future such item — share one
-- implementation. Each panel shows either free text or an uploaded file, per
-- `mode`, and is shown to residents only once it has content.
create table if not exists info_panels (
  slug text primary key,
  menu_label text not null,
  mode text not null default 'text' check (mode in ('text', 'pdf')),
  body text not null default '',
  file_path text, -- storage key in the 'community' bucket (file mode)
  file_name text,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

insert into info_panels (slug, menu_label, sort_order) values
  ('clinic', 'מרפאה', 10),
  ('store', 'מכולת', 20)
on conflict (slug) do nothing;

-- Carry over whatever was already configured for the מכולת (from store_info).
update info_panels p
set menu_label = s.menu_label,
    mode = s.mode,
    body = s.body,
    file_path = s.file_path,
    file_name = s.file_name,
    updated_at = now()
from store_info s
where p.slug = 'store';

alter table info_panels enable row level security;
drop policy if exists info_panels_read on info_panels;
create policy info_panels_read on info_panels for select using (true);
