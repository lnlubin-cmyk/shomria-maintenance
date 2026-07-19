-- =====================================================================
-- Optional sample faults.
--
-- Run only AFTER at least one user account exists (faults.created_by_user_id
-- references users). Attributes every sample call to the first user found.
-- =====================================================================

insert into faults (
  caller_resident_id,
  created_by_user_id,
  building_plot_number,
  fault_description,
  status,
  treatment_type,
  treatment_description
)
select
  v.caller,
  (select id from users order by created_at limit 1),
  v.plot,
  v.descr,
  v.st::fault_status,
  v.tt::treatment_type,
  v.treat
from (values
  ('900000001', '101', 'נזילה מתחת לכיור במטבח', 'received',     null,          null),
  ('900000003', '102', 'תאורה בחדר השינה לא נדלקת', 'in_treatment', 'electricity', 'הוחלף מפסק, ממתין לבדיקה'),
  ('900000005', '103', 'דלת הכניסה לא נסגרת עד הסוף', 'fixed',    'other',       'הוחלף ציר עליון'),
  ('900000007', '104', 'מזגן בסלון מטפטף', 'closed',              'other',       'נוקה צינור הניקוז'),
  ('900000009', '201', 'ברז במטבח חדר האוכל דולף', 'received',    null,          null),
  ('900000011', '204', 'שקע חשמל בכיתה ג׳ שרוף', 'in_treatment',  'electricity', 'הוזמן חלק חלופי')
) as v(caller, plot, descr, st, tt, treat)
where exists (select 1 from users);

-- force_initial_fault_status resets every new row to 'received' and clears
-- treatment_description — correct for the real flow, so re-apply the sample
-- values here as an update rather than weakening the trigger.
update faults set status = 'in_treatment', treatment_description = 'הוחלף מפסק, ממתין לבדיקה'
  where fault_description like 'תאורה בחדר השינה%';
update faults set status = 'fixed', treatment_description = 'הוחלף ציר עליון'
  where fault_description like 'דלת הכניסה%';
update faults set status = 'closed', treatment_description = 'נוקה צינור הניקוז'
  where fault_description like 'מזגן בסלון%';
update faults set status = 'in_treatment', treatment_description = 'הוזמן חלק חלופי'
  where fault_description like 'שקע חשמל בכיתה%';

-- Priority variety (default is 'normal').
update faults set priority = 'very_urgent' where fault_description like 'נזילה מתחת לכיור%';
update faults set priority = 'very_urgent' where fault_description like 'שקע חשמל בכיתה%';
update faults set priority = 'can_wait'    where fault_description like 'דלת הכניסה%';

select fault_number, status, priority, fault_description from faults order by fault_number;
