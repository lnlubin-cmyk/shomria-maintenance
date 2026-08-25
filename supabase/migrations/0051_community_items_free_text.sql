-- Menu items (קהילה / מידע לתושב / תורה ותפילה) can now be free rich text
-- instead of an uploaded file. `mode` picks which is shown; `body` holds the
-- sanitized rich-text HTML (bold / italic / underline + line breaks), exactly
-- like info_panels. Both are stored so the admin can toggle between them.
-- Existing rows default to 'file', preserving current behaviour.
alter table community_items add column if not exists mode text not null default 'file';
alter table community_items add column if not exists body text not null default '';

alter table community_items drop constraint if exists community_items_mode_chk;
alter table community_items add constraint community_items_mode_chk check (mode in ('file', 'text'));

comment on column community_items.mode is 'file = PDF/תמונה מצורף, text = טקסט חופשי (body)';
comment on column community_items.body is 'טקסט חופשי (HTML מסונן: מודגש/נטוי/קו-תחתון) — מוצג כאשר mode=text';
