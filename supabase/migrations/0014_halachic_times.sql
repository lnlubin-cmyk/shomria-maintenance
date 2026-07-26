-- =====================================================================
-- זמנים הלכתיים — halachic times for Shomria, one row per (Hebrew year, month,
-- day). The admin uploads a yearly Excel (12 tabs, or 13 in a leap year with
-- אדר א / אדר ב); it's parsed and each day's times are stored here. The site
-- computes today's Hebrew date and reads the matching row.
-- =====================================================================

create table if not exists halachic_times (
  hebrew_year   int  not null,                 -- e.g. 5786
  month_name    text not null,                 -- canonical Hebrew month: תשרי, חשוון … אדר / אדר א / אדר ב
  hebrew_day    int  not null check (hebrew_day between 1 and 30),
  day_title     text,                          -- תיאור היום (e.g. יום כיפור, ראש חודש)
  gregorian_day int,                           -- cross-check (from "יום לועזי" where present)
  times         jsonb not null default '[]',   -- [{ "label": "...", "time": "5:13" }, ...] in display order
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (hebrew_year, month_name, hebrew_day)
);

comment on table halachic_times is 'זמנים הלכתיים לפי תאריך עברי, מתוך לוח הזמנים השנתי של שומריה.';

-- Everyone signed in may read; only admin writes (page is behind login).
alter table halachic_times enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'halachic_times' and policyname = 'halachic_select_all') then
    create policy halachic_select_all on halachic_times for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'halachic_times' and policyname = 'halachic_admin_all') then
    create policy halachic_admin_all on halachic_times for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists halachic_times_updated_at on halachic_times;
create trigger halachic_times_updated_at
  before update on halachic_times
  for each row execute function set_updated_at();
