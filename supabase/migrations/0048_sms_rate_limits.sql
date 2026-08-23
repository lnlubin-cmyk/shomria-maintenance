-- Per-IP and per-phone daily caps for the SMS-send route, to block SMS-bombing,
-- runaway SMS cost, and mass resident-enumeration via the `eligible` flag.
-- A simple (bucket, day) counter; the route bumps "ip:<addr>" and "phone:<num>".
create table if not exists sms_rate_limits (
  bucket text not null,
  day    date not null,
  count  integer not null default 0,
  primary key (bucket, day)
);

alter table sms_rate_limits enable row level security;
-- Touched only by the service role (via bump_sms_rate); no policies needed.

-- Atomic insert-or-increment that returns the new count for the day.
create or replace function bump_sms_rate(p_bucket text, p_day date)
returns integer
language plpgsql
as $$
declare c integer;
begin
  insert into sms_rate_limits (bucket, day, count) values (p_bucket, p_day, 1)
  on conflict (bucket, day) do update set count = sms_rate_limits.count + 1
  returning count into c;
  return c;
end $$;

-- Only the service role may call it — otherwise a client could inflate someone
-- else's phone counter and lock their login out for the day.
revoke all on function bump_sms_rate(text, date) from public;
grant execute on function bump_sms_rate(text, date) to service_role;
