-- =====================================================================
-- A non-resident account may now hold ANY role (not just maintenance).
--
-- "Resident vs non-resident" is the resident_id link (the indicator); the role
-- is independent, so an אדמין / plain member / maintenance can all be created as
-- non-resident. A non-resident still must carry its own name for display.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'users_identity_check') then
    alter table users drop constraint users_identity_check;
  end if;
  alter table users add constraint users_identity_check check (
    resident_id is not null
    or (first_name is not null and last_name is not null)
  );
end $$;
