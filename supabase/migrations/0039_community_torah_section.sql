-- Add a third menu section for document items: 'torah' → "תורה ותפילה".
alter table community_items drop constraint if exists community_items_section_check;
alter table community_items
  add constraint community_items_section_check check (section in ('community', 'info', 'torah'));

comment on column community_items.section is 'מדור התפריט: קהילה / מידע לתושב / תורה ותפילה.';
