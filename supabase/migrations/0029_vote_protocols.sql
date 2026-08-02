-- =====================================================================
-- vote_protocols — an immutable written protocol (record) of a vote, produced
-- once the vote is finally closed (closed, and its manual count approved if it
-- had one). Kept for regulatory purposes and shown in the votes history.
--
-- The snapshot is generated server-side and read server-side only (like
-- vote_tallies) — no policy for `authenticated`. It is voided (deleted) if the
-- committee re-enters the manual count, so it always reflects the final result.
-- =====================================================================
create table if not exists vote_protocols (
  vote_id       uuid primary key references votes (id) on delete cascade,
  content       jsonb not null,
  generated_at  timestamptz not null default now()
);

comment on table vote_protocols is 'פרוטוקול הצבעה — תיעוד קבוע של תוצאות ההצבעה, נוצר עם סגירתה הסופית.';

alter table vote_protocols enable row level security;
-- No policies for `authenticated`: the protocol is generated and read via the
-- service role (the protocol page renders server-side).
