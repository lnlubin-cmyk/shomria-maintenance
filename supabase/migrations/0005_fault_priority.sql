-- =====================================================================
-- Add priority to faults — עדיפות הטיפול.
--   דחוף מאוד / רגיל / יכול לחכות
--
-- 0001 now defines the type, column, and guard; on a fresh build every
-- statement here is a guarded no-op. This migrates an already-provisioned DB.
-- Idempotent.
-- =====================================================================

-- Enum type.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'fault_priority') then
    create type fault_priority as enum ('very_urgent', 'normal', 'can_wait');
  end if;
end $$;

-- Column, defaulting to 'רגיל'. New and existing calls all start normal.
alter table faults add column if not exists priority fault_priority not null default 'normal';

-- Extend the column guard so a non-staff caller cannot change priority either.
-- (Residents can't update faults at all today; this keeps the rule true if that
-- policy is ever widened.)
create or replace function guard_fault_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not is_staff() then
    if new.treatment_description is distinct from old.treatment_description then
      raise exception 'רק איש תחזוקה רשאי לערוך את תיאור הטיפול';
    end if;
    if new.status is distinct from old.status then
      raise exception 'רק איש תחזוקה רשאי לשנות את סטטוס התקלה';
    end if;
    if new.treatment_type is distinct from old.treatment_type then
      raise exception 'רק איש תחזוקה רשאי לשנות את סוג הטיפול';
    end if;
    if new.assigned_to_user_id is distinct from old.assigned_to_user_id then
      raise exception 'רק איש תחזוקה רשאי לשנות אחריות';
    end if;
    if new.priority is distinct from old.priority then
      raise exception 'רק איש תחזוקה רשאי לשנות עדיפות';
    end if;
  end if;

  return new;
end;
$$;

-- Demo variety on the sample calls, so the new column isn't uniformly 'normal'.
-- Only touches still-default rows, so re-running is safe.
update faults set priority = 'very_urgent'
  where priority = 'normal' and fault_description like 'נזילה מתחת לכיור%';
update faults set priority = 'very_urgent'
  where priority = 'normal' and fault_description like 'שקע חשמל בכיתה%';
update faults set priority = 'can_wait'
  where priority = 'normal' and fault_description like 'דלת הכניסה%';
