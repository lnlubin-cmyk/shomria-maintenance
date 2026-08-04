-- =====================================================================
-- Fault statuses: remove 'closed' (הקריאה סגורה), add 'on_hold' (בהמתנה) and
-- 'duplicate' (כפול — יש כבר קריאה במערכת). 'fixed' (התקלה תוקנה) becomes the
-- terminal "done" state. Existing 'closed' calls are mapped to 'fixed' (they
-- were already resolved). Postgres can't drop an enum value, so the type is
-- recreated.
-- =====================================================================

-- 1) Recreate the enum with the new set of values.
create type fault_status_new as enum (
  'received',      -- התקלה התקבלה במערכת
  'in_treatment',  -- התקלה בטיפול
  'on_hold',       -- בהמתנה
  'fixed',         -- התקלה תוקנה (מצב סיום)
  'duplicate'      -- כפול (יש כבר קריאה במערכת)
);

alter table faults alter column status drop default;

alter table faults
  alter column status type fault_status_new
  using (case when status::text = 'closed' then 'fixed' else status::text end)::fault_status_new;

alter table faults alter column status set default 'received';

drop type fault_status;
alter type fault_status_new rename to fault_status;

-- 2) closed_at (תאריך סגירה) now tracks the terminal states 'fixed'/'duplicate'
--    instead of the removed 'closed'. Stamp it when a call first reaches a
--    terminal state; clear it if the call is reopened.
create or replace function sync_fault_closed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.closed_at = case when new.status in ('fixed', 'duplicate') then now() else null end;
  elsif new.status in ('fixed', 'duplicate') and old.status not in ('fixed', 'duplicate') then
    new.closed_at = now();
  elsif new.status not in ('fixed', 'duplicate') then
    new.closed_at = null;
  end if;
  return new;
end;
$$;
