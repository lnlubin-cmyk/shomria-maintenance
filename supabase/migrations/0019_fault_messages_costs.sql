-- =====================================================================
-- Fault (קריאה לצוות חצר) enhancements:
--   * fault_messages — every SMS/update sent to the resident (unlimited), incl.
--     the automatic "call received" message. Relational, one row per message.
--   * fault_cost_items — cost lines per call (description + amount).
--   * faults.total_cost — kept in sync from the cost items by a trigger.
--   * faults.hours_spent — hours the yard team spent on the call.
-- Cost/hours are staff-only; messages are readable by staff and by the caller.
-- =====================================================================

alter table faults add column if not exists hours_spent numeric(6, 2);
alter table faults add column if not exists total_cost  numeric(10, 2) not null default 0;

comment on column faults.total_cost is 'סכום פריטי העלות של הקריאה (מתוחזק אוטומטית).';
comment on column faults.hours_spent is 'שעות עבודה של צוות חצר על הקריאה.';

-- ---------------------------------------------------------------------
-- fault_messages
-- ---------------------------------------------------------------------
create table if not exists fault_messages (
  id                  uuid primary key default uuid_generate_v4(),
  fault_number        bigint not null references faults (fault_number) on delete cascade,
  body                text not null,
  to_phone            text,                       -- resident phone at send time
  sms_ok              boolean,                    -- did the 019 send succeed?
  sms_status          text,                       -- provider status / error
  is_automatic        boolean not null default false,
  created_by_user_id  uuid references users (id) on delete set null,  -- null = system
  created_at          timestamptz not null default now()
);

create index if not exists fault_messages_fault_idx on fault_messages (fault_number, created_at);

alter table fault_messages enable row level security;

do $$
begin
  -- Staff: full access.
  if not exists (select 1 from pg_policies where tablename = 'fault_messages' and policyname = 'fault_messages_staff_all') then
    create policy fault_messages_staff_all on fault_messages
      for all to authenticated using (is_staff()) with check (is_staff());
  end if;
  -- The caller/opener may read their own call's messages.
  if not exists (select 1 from pg_policies where tablename = 'fault_messages' and policyname = 'fault_messages_caller_read') then
    create policy fault_messages_caller_read on fault_messages
      for select to authenticated using (
        exists (
          select 1 from faults f
          where f.fault_number = fault_messages.fault_number
            and (f.caller_resident_id = current_resident_id() or f.created_by_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- fault_cost_items  (staff only)
-- ---------------------------------------------------------------------
create table if not exists fault_cost_items (
  id                  uuid primary key default uuid_generate_v4(),
  fault_number        bigint not null references faults (fault_number) on delete cascade,
  description         text not null default '',
  amount              numeric(10, 2) not null default 0,
  created_by_user_id  uuid references users (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists fault_cost_items_fault_idx on fault_cost_items (fault_number, created_at);

alter table fault_cost_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'fault_cost_items' and policyname = 'fault_cost_items_staff_all') then
    create policy fault_cost_items_staff_all on fault_cost_items
      for all to authenticated using (is_staff()) with check (is_staff());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Keep faults.total_cost in sync with the cost items.
-- ---------------------------------------------------------------------
create or replace function recompute_fault_total_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn bigint := coalesce(new.fault_number, old.fault_number);
begin
  update faults
     set total_cost = coalesce((select sum(amount) from fault_cost_items where fault_number = fn), 0)
   where fault_number = fn;
  return null;
end;
$$;

drop trigger if exists fault_cost_items_total on fault_cost_items;
create trigger fault_cost_items_total
  after insert or update or delete on fault_cost_items
  for each row execute function recompute_fault_total_cost();
