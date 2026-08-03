-- =====================================================================
-- צור קשר — Contacts, admin-managed. A flat, ordered list of units in the
-- kibbutz (e.g. "משרד"). Each contact has a name (required) plus an optional
-- email and phone. Admin controls the order and can hide a contact.
-- =====================================================================

create table if not exists contacts (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null default '',   -- שם היחידה (e.g. משרד)
  email       text not null default '',   -- אופציונלי
  phone       text not null default '',   -- אופציונלי
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table contacts is 'אנשי קשר / יחידות בישוב (שם, דוא״ל, טלפון) בניהול אדמין.';

create index if not exists contacts_order_idx on contacts (is_visible, sort_order, created_at);

alter table contacts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'contacts' and policyname = 'contacts_select_visible') then
    create policy contacts_select_visible on contacts for select to authenticated using (is_visible = true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'contacts' and policyname = 'contacts_admin_all') then
    create policy contacts_admin_all on contacts for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();
