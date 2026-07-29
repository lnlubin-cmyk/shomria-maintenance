-- =====================================================================
-- buildings.water_heater_type — סוג הדוד (e.g. דוד שמש / דוד חשמל).
-- Free text so any local wording is accepted; shown in the buildings grid.
-- =====================================================================
alter table buildings add column if not exists water_heater_type text;
comment on column buildings.water_heater_type is 'סוג דוד המים (למשל: דוד שמש, דוד חשמל).';
