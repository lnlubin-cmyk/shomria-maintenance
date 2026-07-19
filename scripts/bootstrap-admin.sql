-- =====================================================================
-- Promote the first admin.
--
-- Chicken-and-egg: /api/auth/link always assigns the 'resident' role, and only
-- an admin can change roles — so the very first admin must be promoted here,
-- by hand, in the Supabase SQL editor.
--
-- Steps:
--   1. Sign in to the site normally with the email of the resident who should
--      be admin. This creates the auth account and the users row.
--   2. Edit the email below to that same address (lowercase).
--   3. Run this in the Supabase SQL editor.
-- =====================================================================

update users
set role = 'admin'
where resident_id = (
  select id from residents where email = 'dorit@example.com'   -- <-- change me
);

-- Verify:
select u.role, r.first_name, r.last_name, r.email
from users u
join residents r on r.id = u.resident_id
order by u.role;
