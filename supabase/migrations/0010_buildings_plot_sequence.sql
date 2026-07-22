-- =====================================================================
-- Auto-assign buildings.plot_number from a sequence.
--
-- Houses can be bulk-loaded (name + layer only), so the plot number is no
-- longer something an admin must supply — the system assigns it via nextval.
-- plot_number stays the text primary key (referenced by faults), but an insert
-- that omits it now receives the next sequence value as its ID.
--
-- The sequence starts at 1000, safely above every existing plot number (the
-- seed uses 101–302), so auto-assigned IDs never collide with hand-entered or
-- seeded ones. Idempotent: `if not exists` keeps the sequence's position on a
-- re-run rather than resetting it.
-- =====================================================================

create sequence if not exists buildings_plot_seq start with 1000;

alter table buildings
  alter column plot_number set default nextval('buildings_plot_seq')::text;

-- Own the sequence to the column so it drops with the table.
alter sequence buildings_plot_seq owned by buildings.plot_number;
