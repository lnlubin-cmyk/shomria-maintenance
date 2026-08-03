-- =====================================================================
-- Allow deleting residents / users who have opened calls, WITHOUT losing the
-- calls. Residents who leave the kibbutz must be removable from the users &
-- residents lists, while their past calls remain as the house's maintenance
-- history.
--
-- Strategy: freeze the caller's name onto each fault (caller_name), then relax
-- the blocking foreign keys from NOT NULL + RESTRICT to SET NULL — so deleting
-- the person detaches the call instead of being blocked. The audit column
-- created_by_user_id (not displayed) simply becomes null.
-- =====================================================================

-- 1) Snapshot of the caller's name — kept in sync while a resident is linked,
--    and frozen once the resident is removed.
alter table faults add column if not exists caller_name text;

comment on column faults.caller_name is
  'שם הפונה (צילום). נשמר גם לאחר מחיקת התושב, כדי לשמר את היסטוריית הקריאות.';

-- Backfill existing rows from the currently-linked resident.
update faults f
set caller_name = r.first_name || ' ' || r.last_name
from residents r
where f.caller_resident_id = r.id
  and (f.caller_name is null or f.caller_name = '');

-- Keep caller_name current on insert / when the caller changes. When the link
-- is cleared (resident deleted → set null), the name is left as-is (frozen).
create or replace function faults_set_caller_name()
returns trigger language plpgsql as $$
begin
  if new.caller_resident_id is not null then
    select r.first_name || ' ' || r.last_name
      into new.caller_name
      from residents r
     where r.id = new.caller_resident_id;
  end if;
  return new;
end $$;

drop trigger if exists faults_caller_name_trg on faults;
create trigger faults_caller_name_trg
  before insert or update of caller_resident_id on faults
  for each row execute function faults_set_caller_name();

-- 2) Relax the blocking foreign keys.

-- caller_resident_id: was NOT NULL + RESTRICT.
alter table faults alter column caller_resident_id drop not null;
alter table faults drop constraint if exists faults_caller_resident_id_fkey;
alter table faults add constraint faults_caller_resident_id_fkey
  foreign key (caller_resident_id) references residents (id) on delete set null;

-- created_by_user_id: was NOT NULL + RESTRICT (audit only, not displayed).
alter table faults alter column created_by_user_id drop not null;
alter table faults drop constraint if exists faults_created_by_user_id_fkey;
alter table faults add constraint faults_created_by_user_id_fkey
  foreign key (created_by_user_id) references users (id) on delete set null;

-- users.resident_id: was RESTRICT — blocked deleting a resident who still had a
-- user account. Clear the link instead.
alter table users drop constraint if exists users_resident_id_fkey;
alter table users add constraint users_resident_id_fkey
  foreign key (resident_id) references residents (id) on delete set null;
