-- =====================================================================
-- SMS one-time codes for registration verification.
--
-- Registration can verify a resident by email (Supabase's native email OTP) or
-- by SMS. The SMS path is our own: we generate a code, send it via 019, and
-- verify it here. One active code per phone; a new send replaces the old.
--
-- Only the service role touches this table (routes run server-side); RLS is on
-- with no policies, so it's inaccessible to normal users.
-- =====================================================================

create table if not exists sms_otps (
  phone       text primary key,                 -- E.164
  code_hash   text not null,                     -- sha256(code + pepper)
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table sms_otps enable row level security;
