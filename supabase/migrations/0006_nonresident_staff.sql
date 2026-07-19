-- =====================================================================
-- Allow non-resident maintenance staff.
--
-- An admin may create an איש תחזוקה / מנהל תחזוקה who is not a kibbutz
-- resident (external contractor). Such a user has no resident_id and carries
-- its own name on the users row.
--
-- 0001 now defines this; on a fresh build every statement is a guarded no-op.
-- Idempotent — safe on an already-provisioned DB.
-- =====================================================================

-- resident_id becomes optional.
alter table users alter column resident_id drop not null;

-- Name columns for non-resident users.
alter table users add column if not exists first_name text;
alter table users add column if not exists last_name  text;

-- Identity rule: linked to a resident, OR external maintenance staff with a name.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_identity_check') then
    alter table users add constraint users_identity_check check (
      resident_id is not null
      or (role in ('maintenance', 'maintenance_manager')
          and first_name is not null and last_name is not null)
    );
  end if;
end $$;
