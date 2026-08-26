-- Per-item icon (an emoji) + optional short description for menu items, so a
-- קהילה/מידע/תורה item can look as rich as the מרפאה/מכולת panels instead of the
-- generic 📄 tile. Empty icon falls back to 📄; empty description falls back to
-- the generic "לחצו לצפייה" line — both handled at render time.
alter table community_items add column if not exists icon text not null default '';
alter table community_items add column if not exists description text not null default '';

comment on column community_items.icon is 'אימוji לכרטיס בדף הבית (ריק = 📄 כברירת מחדל)';
comment on column community_items.description is 'תיאור קצר המוצג מתחת לכותרת הכרטיס (לא חובה)';
