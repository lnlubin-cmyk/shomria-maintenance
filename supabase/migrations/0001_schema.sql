-- =====================================================================
-- קיבוץ שומריה — מערכת ניהול תחזוקה
-- Schema: residents, users, buildings, faults
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- סוגי משתמשים
create type user_role as enum (
  'admin',                -- אדמין — מורשה להכל
  'resident',             -- תושב
  'maintenance',          -- איש תחזוקה
  'maintenance_manager'   -- מנהל תחזוקה
);

-- סטטוס תקלה
create type fault_status as enum (
  'received',      -- התקלה התקבלה במערכת
  'in_treatment',  -- התקלה בטיפול
  'fixed',         -- התקלה תוקנה
  'closed'         -- הקריאה סגורה
);

-- סוג הטיפול
create type treatment_type as enum (
  'electricity',   -- חשמל
  'plumbing',      -- אינסטלציה
  'other'          -- אחר
);

-- ---------------------------------------------------------------------
-- תושבים (residents)
-- Also serves as the allowlist of who may register for the system.
-- ---------------------------------------------------------------------
create table residents (
  id           text primary key,           -- תעודת זהות
  first_name   text not null,              -- שם פרטי
  last_name    text not null,              -- שם משפחה
  phone        text not null unique,       -- מספר טלפון (E.164, e.g. +972501234567)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table residents is 'תושבי הישוב. מהווה גם רשימת ההרשאה להרשמה למערכת.';

create index residents_last_name_idx  on residents (last_name);
create index residents_first_name_idx on residents (first_name);

-- ---------------------------------------------------------------------
-- משתמשים (users)
-- One row per authenticated account. id mirrors auth.users.id.
-- ---------------------------------------------------------------------
create table users (
  id           uuid primary key references auth.users (id) on delete cascade,
  resident_id  text not null references residents (id) on delete restrict,
  role         user_role not null default 'resident',   -- סוג המשתמש
  email        text,
  phone        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One account per resident.
  constraint users_resident_unique unique (resident_id)
);

comment on table users is 'חשבונות משתמש. מקושר לתושב ומגדיר את סוג המשתמש.';

create index users_role_idx on users (role);

-- ---------------------------------------------------------------------
-- מבנים (buildings)
-- ---------------------------------------------------------------------
create table buildings (
  plot_number   text primary key,                                  -- מספר מגרש
  street_name   text,                                              -- שם רחוב (לא חובה)
  house_number  text,                                              -- מספר בית (לא חובה)
  building_name text not null,                                     -- שם המבנה
  resident_1    text references residents (id) on delete set null, -- תושב 1
  resident_2    text references residents (id) on delete set null, -- תושב 2
  resident_3    text references residents (id) on delete set null, -- תושב 3
  resident_4    text references residents (id) on delete set null, -- תושב 4

  -- Reserved for the future family-names map (goal #2 in the spec).
  latitude      double precision,
  longitude     double precision,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table buildings is 'רשימת המבנים בישוב.';
comment on column buildings.latitude is 'שמור למפה עתידית — לא בשימוש כרגע.';

create index buildings_name_idx on buildings (building_name);
create index buildings_r1_idx on buildings (resident_1);
create index buildings_r2_idx on buildings (resident_2);
create index buildings_r3_idx on buildings (resident_3);
create index buildings_r4_idx on buildings (resident_4);

-- ---------------------------------------------------------------------
-- תקלות (faults)
-- ---------------------------------------------------------------------
create table faults (
  fault_number          bigint generated always as identity primary key,  -- מספר תקלה

  -- שם הפונה — the resident the call is on behalf of. Defaults in the UI to the
  -- current user's resident, but may be another resident (spec, screen 2a).
  caller_resident_id    text not null references residents (id) on delete restrict,

  -- נפתחה ע"י — audit trail of which account actually submitted the call.
  -- Distinct from caller_resident_id, which is who the call is *for*.
  created_by_user_id    uuid not null references users (id) on delete restrict,

  -- שם המבנה — FK to buildings rather than free text, so renaming a building
  -- does not orphan its history.
  building_plot_number  text not null references buildings (plot_number) on delete restrict,

  fault_description     text not null,                        -- תיאור התקלה (חובה)
  status                fault_status not null default 'received',  -- סטטוס תקלה
  assigned_to_user_id   uuid references users (id) on delete set null,  -- אחריות (איש תחזוקה)
  treatment_description text,                                 -- תיאור הטיפול
  treatment_type        treatment_type,                       -- סוג הטיפול
  closed_at             timestamptz,                          -- תאריך סגירה
  created_at            timestamptz not null default now(),   -- תאריך פתיחת הקריאה
  updated_at            timestamptz not null default now()
);

comment on table faults is 'קריאות תקלה.';
comment on column faults.caller_resident_id is 'שם הפונה — התושב שעבורו נפתחה הקריאה.';
comment on column faults.created_by_user_id is 'נפתחה ע"י — המשתמש שהגיש את הקריאה בפועל.';

create index faults_created_at_idx  on faults (created_at desc);
create index faults_status_idx      on faults (status);
create index faults_caller_idx      on faults (caller_resident_id);
create index faults_creator_idx     on faults (created_by_user_id);
create index faults_building_idx    on faults (building_plot_number);
create index faults_assigned_idx    on faults (assigned_to_user_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger residents_updated_at  before update on residents  for each row execute function set_updated_at();
create trigger users_updated_at      before update on users      for each row execute function set_updated_at();
create trigger buildings_updated_at  before update on buildings  for each row execute function set_updated_at();
create trigger faults_updated_at     before update on faults     for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Stamp closed_at when a fault moves to 'closed', clear it if reopened.
-- ---------------------------------------------------------------------
create or replace function sync_fault_closed_at()
returns trigger
language plpgsql
as $$
begin
  -- OLD is unassigned on INSERT — branch on TG_OP rather than relying on
  -- another trigger having already pinned status to a non-closed value.
  if tg_op = 'INSERT' then
    new.closed_at = case when new.status = 'closed' then now() else null end;
  elsif new.status = 'closed' and old.status is distinct from 'closed' then
    new.closed_at = now();
  elsif new.status <> 'closed' then
    new.closed_at = null;
  end if;
  return new;
end;
$$;

create trigger faults_sync_closed_at
  before insert or update on faults
  for each row execute function sync_fault_closed_at();
