-- Merge the fixed info-panels (מרפאה/clinic, מכולת/store) into ordinary
-- community_items so they stop being a separate subsystem. Additive and
-- non-destructive: info_panels is dropped later (0056) once the new code is live.

-- A stable handle so the newsletter "clinic" target and the old-URL redirects
-- can find these specific items. Nullable + unique → only these rows carry a
-- key (Postgres allows many NULLs under a unique index).
alter table community_items add column if not exists key text;
create unique index if not exists community_items_key_uidx on community_items (key);

-- Copy מרפאה (clinic) and מכולת (store) from info_panels into community_items,
-- mapping info_panels.mode ('text'|'pdf') → community_items.mode ('text'|'file').
-- Files stay in the shared 'community' bucket, so file_path carries over as-is.
insert into community_items
  (subject, section, mode, body, icon, description, file_path, file_name, is_visible, sort_order, key)
select
  p.menu_label,
  'info',
  case when p.mode = 'pdf' then 'file' else 'text' end,
  p.body,
  case p.slug when 'clinic' then '🩺' when 'store' then '🛒' else '' end,
  case p.slug
    when 'clinic' then 'שעות פעילות ומידע על המרפאה.'
    when 'store'  then 'שעות פתיחה ומידע על המכולת.'
    else '' end,
  p.file_path,
  p.file_name,
  true,
  case p.slug when 'clinic' then -20 when 'store' then -10 else 0 end,
  p.slug
from info_panels p
where p.slug in ('clinic', 'store')
on conflict (key) do nothing;
