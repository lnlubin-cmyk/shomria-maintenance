-- Allow a גבאי to be an external (non-resident) user with their own name, like
-- maintenance staff — so an admin can appoint a gabbai who isn't a resident.
alter table users drop constraint if exists users_identity_check;
alter table users add constraint users_identity_check check (
  resident_id is not null
  or (role in ('maintenance', 'maintenance_manager', 'gabbai')
      and first_name is not null and last_name is not null)
);
