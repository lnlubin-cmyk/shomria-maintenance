-- =====================================================================
-- Row Level Security
--
-- Rules from the spec:
--   * תושב      — sees only faults in his own name; may open new calls.
--   * איש תחזוקה — sees all faults; may edit status / treatment description / type.
--   * מנהל תחזוקה — as above, plus delete.
--   * אדמין      — everything, including residents/buildings/users CRUD.
--
-- Column-level rules (e.g. "a resident may not edit תיאור התיקון") are enforced
-- by the guard trigger at the bottom, because Postgres RLS gates rows, not
-- columns, and every Supabase end user shares the `authenticated` DB role.
-- =====================================================================

alter table residents enable row level security;
alter table users     enable row level security;
alter table buildings enable row level security;
alter table faults    enable row level security;

-- ---------------------------------------------------------------------
-- Helpers.
-- SECURITY DEFINER so they can read `users` without recursing into the
-- policies defined on `users` itself.
-- ---------------------------------------------------------------------
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid() and is_active;
$$;

create or replace function current_resident_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select resident_id from users where id = auth.uid() and is_active;
$$;

-- Maintenance staff = איש תחזוקה, מנהל תחזוקה, אדמין
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() in ('maintenance', 'maintenance_manager', 'admin');
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() = 'admin';
$$;

-- מנהל תחזוקה או אדמין — the only roles that may delete faults.
create or replace function can_delete_faults()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() in ('maintenance_manager', 'admin');
$$;

-- ---------------------------------------------------------------------
-- residents
-- Staff need to read residents to resolve caller names and to search when
-- opening a call on someone else's behalf. Only admin may write.
-- ---------------------------------------------------------------------

-- Is this resident the caller on a fault the current user opened?
-- SECURITY DEFINER so the faults lookup does not re-enter faults' own policies.
create or replace function is_caller_on_my_fault(target_resident_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from faults
    where caller_resident_id = target_resident_id
      and created_by_user_id = auth.uid()
  );
$$;

-- A resident may read: themselves, and anyone they have opened a call for.
-- Without the second clause, opening a call on someone's behalf (spec 2a)
-- succeeds but their name renders as "—" in the opener's own list, because the
-- embedded residents row is filtered away.
create policy residents_select_self on residents
  for select to authenticated
  using (
    id = current_resident_id()
    or is_staff()
    or is_caller_on_my_fault(id)
  );

create policy residents_admin_all on residents
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
create policy users_select_self on users
  for select to authenticated
  using (id = auth.uid() or is_staff());

create policy users_admin_all on users
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------
-- buildings
-- Every authenticated user may read buildings — a resident must be able to
-- search for a building when opening a call. Only admin may write.
-- ---------------------------------------------------------------------
create policy buildings_select_all on buildings
  for select to authenticated
  using (true);

create policy buildings_admin_all on buildings
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------
-- faults
-- ---------------------------------------------------------------------

-- תושב sees only calls in his own name. Staff see everything.
create policy faults_select on faults
  for select to authenticated
  using (
    is_staff()
    or caller_resident_id = current_resident_id()
    or created_by_user_id = auth.uid()
  );

-- Any registered user may open a call, for themselves or on behalf of another
-- resident (spec, screen 2a: "יש אפשרות לפתוח עבור תושב אחר").
-- The one thing we pin down is authorship: you cannot attribute a call to
-- another account.
create policy faults_insert on faults
  for insert to authenticated
  with check (created_by_user_id = auth.uid());

-- Only staff may update a fault at all. Which *columns* they may touch is
-- enforced by faults_guard_columns below.
create policy faults_update on faults
  for update to authenticated
  using (is_staff())
  with check (is_staff());

-- Only מנהל תחזוקה / אדמין may delete.
create policy faults_delete on faults
  for delete to authenticated
  using (can_delete_faults());

-- ---------------------------------------------------------------------
-- Column guard: a resident may never write תיאור הטיפול / סטטוס / סוג הטיפול.
--
-- The update policy above already limits UPDATE to staff, so this is a second
-- line of defence — it keeps the rule true even if that policy is ever widened
-- to let residents edit their own descriptions.
-- ---------------------------------------------------------------------
create or replace function guard_fault_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (admin screens, imports) bypasses this guard.
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
  end if;

  return new;
end;
$$;

create trigger faults_guard_columns
  before update on faults
  for each row execute function guard_fault_columns();

-- ---------------------------------------------------------------------
-- A new fault always enters the system as "התקלה התקבלה במערכת", regardless of
-- what the client sends.
-- ---------------------------------------------------------------------
-- guard_fault_columns is BEFORE UPDATE only, and faults_insert checks just the
-- author — so without this, a resident could POST straight to the REST API with
-- assigned_to_user_id set to their own uid and self-assign אחריות on their own
-- call. A new call always starts unassigned and untreated; only staff, via
-- update, can change that.
--
-- treatment_type is intentionally NOT cleared: it is a classification the
-- opener may legitimately supply, and scripts/seed-faults.sql relies on it
-- surviving the insert.
create or replace function force_initial_fault_status()
returns trigger
language plpgsql
as $$
begin
  new.status = 'received';
  new.treatment_description = null;
  new.assigned_to_user_id = null;
  new.closed_at = null;
  return new;
end;
$$;

create trigger faults_force_initial_status
  before insert on faults
  for each row execute function force_initial_fault_status();
