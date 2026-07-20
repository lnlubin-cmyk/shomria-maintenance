-- =====================================================================
-- Map foundation: building layers + geolocation.
--
--  * building_layers — categorizes a building and carries its display prefix.
--    Two initial layers: "בתים" (prefix "בית משפחת") and "מבני ציבור" (no prefix).
--  * buildings.building_name now holds the BARE name ("לוי", not "בית משפחת לוי").
--    Dropdowns/lists render prefix + name; the map renders the bare name.
--  * buildings gains layer_id and ITM coordinates (itm_x/itm_y). WGS84
--    latitude/longitude already exist from 0001.
--
-- Idempotent — safe on the live DB and on a fresh build (after 0003 seeds the
-- old "בית משפחת X" names, this strips them and assigns layers).
-- =====================================================================

-- ---------------------------------------------------------------------
-- building_layers
-- ---------------------------------------------------------------------
create table if not exists building_layers (
  id          serial primary key,
  name        text not null unique,           -- "בתים", "מבני ציבור"
  prefix      text not null default '',        -- "בית משפחת", ""
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table building_layers is 'שכבות מבנים למפה. הפריפיקס משמש לתצוגת שם המבנה ברשימות.';

insert into building_layers (name, prefix, sort_order) values
  ('בתים', 'בית משפחת', 1),
  ('מבני ציבור', '', 2)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- buildings: layer + coordinates
-- ---------------------------------------------------------------------
alter table buildings add column if not exists layer_id integer references building_layers (id);
alter table buildings add column if not exists itm_x double precision;  -- ITM easting (EPSG:2039)
alter table buildings add column if not exists itm_y double precision;  -- ITM northing

-- Family homes: "בית משפחת לוי" -> name "לוי", layer "בתים".
update buildings
set
  building_name = trim(substring(building_name from '^בית משפחת (.*)$')),
  layer_id = (select id from building_layers where name = 'בתים')
where building_name ~ '^בית משפחת ';

-- Everything else -> "מבני ציבור" (name unchanged).
update buildings
set layer_id = (select id from building_layers where name = 'מבני ציבור')
where layer_id is null;

-- ---------------------------------------------------------------------
-- RLS — everyone authenticated may read layers; only admin writes.
-- ---------------------------------------------------------------------
alter table building_layers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'building_layers' and policyname = 'building_layers_select_all') then
    create policy building_layers_select_all on building_layers
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'building_layers' and policyname = 'building_layers_admin_all') then
    create policy building_layers_admin_all on building_layers
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

-- Keep updated_at fresh.
drop trigger if exists building_layers_updated_at on building_layers;
create trigger building_layers_updated_at
  before update on building_layers
  for each row execute function set_updated_at();
