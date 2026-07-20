-- =====================================================================
-- Privacy consent — per-resident visibility choices.
--
--  * share_phone — may my phone be shown to registered users (phone directory)?
--    Default FALSE: opt-in.
--  * share_house — may my house be shown to registered users (map)?
--    Default TRUE: opt-out. Preserves the current "all houses shown" behavior.
--
-- Enforced when displaying: the map shows a family building only if at least
-- one of its residents has share_house = true; the (future) phone directory
-- will list a resident only if share_phone = true.
--
-- Idempotent.
-- =====================================================================

alter table residents add column if not exists share_phone boolean not null default false;
alter table residents add column if not exists share_house boolean not null default true;

comment on column residents.share_phone is 'הסכמה להצגת מספר הטלפון לרשומים באתר.';
comment on column residents.share_house is 'הסכמה להצגת הבית במפה לרשומים באתר.';
