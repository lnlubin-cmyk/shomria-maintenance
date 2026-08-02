-- =====================================================================
-- community_items.section — which menu section a document item belongs to:
--   'community' → "קהילה" (the existing behaviour, default)
--   'info'      → "מידע לתושב"
-- Lets an admin add a menu item + PDF under either section.
-- =====================================================================
alter table community_items
  add column if not exists section text not null default 'community'
  check (section in ('community', 'info'));

comment on column community_items.section is 'מדור התפריט שאליו שייך הפריט: קהילה או מידע לתושב.';

create index if not exists community_items_section_idx on community_items (section, sort_order);
