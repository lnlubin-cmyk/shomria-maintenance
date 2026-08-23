-- Harden the "new fault always starts fresh" trigger: also force priority to the
-- default on INSERT. The column guard is BEFORE UPDATE only and the insert RLS
-- policy checks just authorship, so without this a resident could POST a call
-- straight to the REST API with priority='very_urgent' and jump the triage queue.
-- Staff set priority via a follow-up UPDATE (createFault), so this is safe.
create or replace function force_initial_fault_status()
returns trigger
language plpgsql
as $$
begin
  new.status = 'received';
  new.priority = 'normal';
  new.treatment_description = null;
  new.assigned_to_user_id = null;
  new.closed_at = null;
  return new;
end;
$$;
