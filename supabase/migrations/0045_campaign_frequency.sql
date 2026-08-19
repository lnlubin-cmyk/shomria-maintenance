-- How often the campaign re-shows on a device: 'once' (default, first entry
-- only) or 'daily' (once per day per device).
alter table campaigns
  add column if not exists frequency text not null default 'once'
  check (frequency in ('once', 'daily'));
