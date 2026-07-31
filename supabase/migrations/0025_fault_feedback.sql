-- =====================================================================
-- fault_feedback — a resident's 1-5 rating of how their call was handled.
--
-- The resident submits it after the fix is done (status 'fixed' or 'closed').
-- The rating is visible ONLY to מנהל תחזוקה / admin (and to the resident who
-- submitted it) — a plain איש תחזוקה cannot see it. That visibility is enforced
-- by RLS; the write goes through a server action that checks the caller + status.
-- =====================================================================
create table if not exists fault_feedback (
  fault_number        bigint primary key references faults (fault_number) on delete cascade,
  rating              smallint not null check (rating between 1 and 5),
  created_by_user_id  uuid references users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table fault_feedback is 'דירוג התושב (1-5) לטיפול בקריאה. גלוי למנהל תחזוקה/אדמין בלבד.';

-- מנהל תחזוקה או אדמין — the only staff who may see resident feedback.
create or replace function is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() in ('maintenance_manager', 'admin');
$$;

alter table fault_feedback enable row level security;

do $$
begin
  -- Read: managers/admin see everything; the submitting resident sees their own.
  -- A plain איש תחזוקה matches neither, so the rating stays hidden from them.
  if not exists (select 1 from pg_policies where tablename = 'fault_feedback' and policyname = 'fault_feedback_select') then
    create policy fault_feedback_select on fault_feedback
      for select to authenticated
      using (is_manager_or_admin() or created_by_user_id = auth.uid());
  end if;
  -- No write policies: feedback is written only by the service role, from a
  -- server action that verifies the caller and that the call is done.
end $$;

drop trigger if exists fault_feedback_updated_at on fault_feedback;
create trigger fault_feedback_updated_at before update on fault_feedback
  for each row execute function set_updated_at();
