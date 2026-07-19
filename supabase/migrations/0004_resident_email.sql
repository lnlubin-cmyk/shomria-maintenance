-- =====================================================================
-- Add email to residents — the login identifier for email-code sign-in.
--
-- 0001_schema.sql now defines this column, so a FRESH rebuild already has it
-- and every statement here is a guarded no-op. This file exists to migrate a
-- database that was provisioned before the column existed. Safe to run on
-- either; idempotent.
-- =====================================================================

alter table residents add column if not exists email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'residents_email_unique') then
    alter table residents add constraint residents_email_unique unique (email);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'residents_email_format') then
    alter table residents add constraint residents_email_format check (
      email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'residents_email_normalized') then
    alter table residents add constraint residents_email_normalized check (
      email is null or email = lower(email)
    );
  end if;
end $$;

-- Backfill the sample residents so the existing live database can log in by
-- email. Matches the addresses in 0003_seed.sql and create-dev-users.mjs.
-- Only touches rows that don't already have an email, so re-running is safe.
update residents set email = v.email
from (values
  ('900000001', 'yossi@example.com'),
  ('900000002', 'michal.levi@example.com'),
  ('900000003', 'avi.cohen@example.com'),
  ('900000004', 'ronit.cohen@example.com'),
  ('900000005', 'daniel.mizrahi@example.com'),
  ('900000006', 'shira.mizrahi@example.com'),
  ('900000007', 'eitan.friedman@example.com'),
  ('900000008', 'noa.friedman@example.com'),
  ('900000009', 'amit.berkovich@example.com'),
  ('900000010', 'tamar.berkovich@example.com'),
  ('900000011', 'uri.shapira@example.com'),
  ('900000012', 'hadas.shapira@example.com'),
  ('900000013', 'gil.azoulay@example.com'),
  ('900000014', 'liat.azoulay@example.com'),
  ('900000015', 'meir.dahan@example.com'),
  ('900000016', 'yael.dahan@example.com'),
  ('900000017', 'moshe@example.com'),
  ('900000018', 'shlomo.bendavid@example.com'),
  ('900000019', 'rafi@example.com'),
  ('900000020', 'dorit@example.com')
) as v(id, email)
where residents.id = v.id and residents.email is null;
