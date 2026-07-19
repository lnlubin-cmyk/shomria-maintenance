-- =====================================================================
-- Sample data — נתוני דוגמה
--
-- Fictional residents and buildings so the system is clickable before the
-- real lists are imported. Safe to delete before going live:
--   delete from faults; delete from buildings; delete from residents;
-- =====================================================================

-- ---------------------------------------------------------------------
-- תושבים
-- ID numbers here are made up and do NOT pass the Israeli check-digit test,
-- so they can never collide with a real תעודת זהות.
-- ---------------------------------------------------------------------
-- Emails are the login identifier. The four used by scripts/create-dev-users.mjs
-- (yossi/moshe/rafi/dorit) must match the account emails there exactly.
insert into residents (id, first_name, last_name, phone, email) values
  ('900000001', 'יוסי',   'לוי',      '+972501000001', 'yossi@example.com'),
  ('900000002', 'מיכל',   'לוי',      '+972501000002', 'michal.levi@example.com'),
  ('900000003', 'אבי',    'כהן',      '+972501000003', 'avi.cohen@example.com'),
  ('900000004', 'רונית',  'כהן',      '+972501000004', 'ronit.cohen@example.com'),
  ('900000005', 'דניאל',  'מזרחי',    '+972501000005', 'daniel.mizrahi@example.com'),
  ('900000006', 'שירה',   'מזרחי',    '+972501000006', 'shira.mizrahi@example.com'),
  ('900000007', 'איתן',   'פרידמן',   '+972501000007', 'eitan.friedman@example.com'),
  ('900000008', 'נועה',   'פרידמן',   '+972501000008', 'noa.friedman@example.com'),
  ('900000009', 'עמית',   'ברקוביץ',  '+972501000009', 'amit.berkovich@example.com'),
  ('900000010', 'תמר',    'ברקוביץ',  '+972501000010', 'tamar.berkovich@example.com'),
  ('900000011', 'אורי',   'שפירא',    '+972501000011', 'uri.shapira@example.com'),
  ('900000012', 'הדס',    'שפירא',    '+972501000012', 'hadas.shapira@example.com'),
  ('900000013', 'גיל',    'אזולאי',   '+972501000013', 'gil.azoulay@example.com'),
  ('900000014', 'ליאת',   'אזולאי',   '+972501000014', 'liat.azoulay@example.com'),
  ('900000015', 'מאיר',   'דהן',      '+972501000015', 'meir.dahan@example.com'),
  ('900000016', 'יעל',    'דהן',      '+972501000016', 'yael.dahan@example.com'),
  -- Staff
  ('900000017', 'משה',    'אוחיון',   '+972501000017', 'moshe@example.com'),      -- איש תחזוקה
  ('900000018', 'שלמה',   'בן דוד',   '+972501000018', 'shlomo.bendavid@example.com'),  -- איש תחזוקה
  ('900000019', 'רפי',    'טל',       '+972501000019', 'rafi@example.com'),       -- מנהל תחזוקה
  ('900000020', 'דורית',  'אלון',     '+972501000020', 'dorit@example.com');      -- אדמין

-- ---------------------------------------------------------------------
-- מבנים
-- ---------------------------------------------------------------------
insert into buildings (plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4) values
  ('101', 'הגפן',   '1',  'בית משפחת לוי',      '900000001', '900000002', null, null),
  ('102', 'הגפן',   '2',  'בית משפחת כהן',      '900000003', '900000004', null, null),
  ('103', 'הגפן',   '3',  'בית משפחת מזרחי',    '900000005', '900000006', null, null),
  ('104', 'הזית',   '1',  'בית משפחת פרידמן',   '900000007', '900000008', null, null),
  ('105', 'הזית',   '2',  'בית משפחת ברקוביץ',  '900000009', '900000010', null, null),
  ('106', 'הזית',   '3',  'בית משפחת שפירא',    '900000011', '900000012', null, null),
  ('107', 'התאנה',  '1',  'בית משפחת אזולאי',   '900000013', '900000014', null, null),
  ('108', 'התאנה',  '2',  'בית משפחת דהן',      '900000015', '900000016', null, null),
  ('201', 'הרימון', '10', 'חדר אוכל',           null, null, null, null),
  ('202', 'הרימון', '12', 'מזכירות',            null, null, null, null),
  ('203', 'הרימון', '14', 'מרפאה',              null, null, null, null),
  ('204', 'הדקל',   '1',  'בית ספר',            null, null, null, null),
  ('205', 'הדקל',   '3',  'גן ילדים - רימון',   null, null, null, null),
  ('206', 'הדקל',   '5',  'מועדון נוער',        null, null, null, null),
  ('301', null,     null, 'מחסן מרכזי',         null, null, null, null),
  ('302', null,     null, 'בריכה',              null, null, null, null);

-- ---------------------------------------------------------------------
-- Sample faults are NOT seeded here.
--
-- faults.created_by_user_id references users(id), which references
-- auth.users(id) — those rows only exist once someone actually signs up.
-- Seed calls after creating accounts, via scripts/seed-faults.sql.
-- ---------------------------------------------------------------------
