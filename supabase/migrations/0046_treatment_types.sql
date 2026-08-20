-- New fault treatment types (סוג הטיפול), in addition to חשמל / אינסטלציה / אחר:
--   doors            → דלתות
--   windows_shutters → חלונות ותריסים
--   carpentry        → נגרות
--   water_heater     → תיקון דוד
alter type treatment_type add value if not exists 'doors';
alter type treatment_type add value if not exists 'windows_shutters';
alter type treatment_type add value if not exists 'carpentry';
alter type treatment_type add value if not exists 'water_heater';
