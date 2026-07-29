-- =====================================================================
-- Votes / elections (הצבעות)
--
-- An admin opens a vote. A ועדת קלפי (up to 15 residents) manages it: any
-- member may close a manual vote and may enter a vote on behalf of a resident
-- who can't access the app.
--
-- Ballot secrecy is the core rule:
--   * The individual choice is NEVER stored. Only anonymous per-option counters
--     (vote_tallies) move, and a participation row (vote_participants) that
--     records THAT a resident voted — never WHAT they chose.
--   * Results (tallies + turnout) are never readable before closure: tallies
--     have no SELECT policy for `authenticated` at all, so they are reachable
--     only through the service role, and only the results page (which checks
--     closure first) reads them.
--
-- Two formats, unified as "choose up to N options":
--   * options  — admin types the answer texts.
--   * election — options are candidate residents the admin picks.
-- =====================================================================

-- ---------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------
create table if not exists votes (
  id                  uuid primary key default uuid_generate_v4(),
  title               text not null,
  description         text,
  subject             text not null,                 -- the question residents answer
  format              text not null default 'options'
                        check (format in ('options', 'election')),
  max_selections      int  not null default 1 check (max_selections >= 1),
  start_at            timestamptz not null,
  closure_mode        text not null
                        check (closure_mode in ('manual', 'scheduled')),
  closes_at           timestamptz,                   -- required when scheduled
  closed_at           timestamptz,                   -- set on manual/early close
  closed_by_user_id   uuid references users (id) on delete set null,
  created_by_user_id  uuid references users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint votes_scheduled_needs_time
    check (closure_mode <> 'scheduled' or closes_at is not null),
  constraint votes_closes_after_start
    check (closes_at is null or closes_at > start_at)
);

comment on table votes is 'הצבעה / בחירות שמנוהלת על ידי ועדת קלפי.';
comment on column votes.subject is 'הנושא/שאלה שהמצביעים מתייחסים אליה.';
comment on column votes.max_selections is 'מספר האפשרויות המרבי שמצביע רשאי לבחור.';

drop trigger if exists votes_updated_at on votes;
create trigger votes_updated_at before update on votes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- vote_options — answer texts, or candidates (election). Labels only; the
-- counts live in vote_tallies so they can be hidden until closure.
-- ---------------------------------------------------------------------
create table if not exists vote_options (
  id                   uuid primary key default uuid_generate_v4(),
  vote_id              uuid not null references votes (id) on delete cascade,
  label                text not null,
  candidate_resident_id text references residents (id) on delete set null,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists vote_options_vote_idx on vote_options (vote_id, sort_order);

-- ---------------------------------------------------------------------
-- vote_committee — ועדת קלפי members (residents), capped at 15 by the app.
-- ---------------------------------------------------------------------
create table if not exists vote_committee (
  id           uuid primary key default uuid_generate_v4(),
  vote_id      uuid not null references votes (id) on delete cascade,
  resident_id  text not null references residents (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (vote_id, resident_id)
);

create index if not exists vote_committee_vote_idx on vote_committee (vote_id);

-- ---------------------------------------------------------------------
-- vote_participants — records THAT a resident voted (to enforce one-per-
-- resident and to let the committee track turnout). Never the choice.
-- ---------------------------------------------------------------------
create table if not exists vote_participants (
  id                uuid primary key default uuid_generate_v4(),
  vote_id           uuid not null references votes (id) on delete cascade,
  resident_id       text not null references residents (id) on delete cascade,
  voted_by_user_id  uuid references users (id) on delete set null,  -- committee member, when on-behalf; null = self
  created_at        timestamptz not null default now(),
  unique (vote_id, resident_id)
);

create index if not exists vote_participants_vote_idx on vote_participants (vote_id);

-- ---------------------------------------------------------------------
-- vote_tallies — the ONLY record of results: an anonymous counter per option.
-- ---------------------------------------------------------------------
create table if not exists vote_tallies (
  option_id  uuid primary key references vote_options (id) on delete cascade,
  count      int not null default 0
);

-- Seed a zero counter as soon as an option is created, so every option always
-- has a tally row (results list all options, including the ones with 0 votes).
create or replace function seed_vote_tally()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into vote_tallies (option_id, count) values (new.id, 0)
    on conflict (option_id) do nothing;
  return new;
end;
$$;

drop trigger if exists vote_options_seed_tally on vote_options;
create trigger vote_options_seed_tally after insert on vote_options
  for each row execute function seed_vote_tally();

-- =====================================================================
-- RLS
-- =====================================================================
alter table votes             enable row level security;
alter table vote_options      enable row level security;
alter table vote_committee    enable row level security;
alter table vote_participants enable row level security;
alter table vote_tallies      enable row level security;

do $$
begin
  -- votes: everyone signed in may read (menu, list, ballot, upcoming/past).
  if not exists (select 1 from pg_policies where tablename = 'votes' and policyname = 'votes_select_all') then
    create policy votes_select_all on votes
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'votes' and policyname = 'votes_admin_all') then
    create policy votes_admin_all on votes
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;

  -- vote_options: labels are readable (needed to render the ballot). Admin writes.
  if not exists (select 1 from pg_policies where tablename = 'vote_options' and policyname = 'vote_options_select_all') then
    create policy vote_options_select_all on vote_options
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'vote_options' and policyname = 'vote_options_admin_all') then
    create policy vote_options_admin_all on vote_options
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;

  -- vote_committee: readable (a member must know they're on the committee). Admin writes.
  if not exists (select 1 from pg_policies where tablename = 'vote_committee' and policyname = 'vote_committee_select_all') then
    create policy vote_committee_select_all on vote_committee
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'vote_committee' and policyname = 'vote_committee_admin_all') then
    create policy vote_committee_admin_all on vote_committee
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;

  -- vote_participants: a resident may read only their OWN row (to see "you
  -- already voted"). No insert/update policy — participation is written only by
  -- cast_vote (security definer) or the service role. The committee's turnout
  -- lists are read server-side via the service role.
  if not exists (select 1 from pg_policies where tablename = 'vote_participants' and policyname = 'vote_participants_select_own') then
    create policy vote_participants_select_own on vote_participants
      for select to authenticated using (resident_id = current_resident_id());
  end if;

  -- vote_tallies: deliberately NO policy for `authenticated`, so counts are
  -- never readable through the user session — not before closure, not after.
  -- Results are served only by the service role, gated on closure in code.
end $$;

-- =====================================================================
-- cast_vote — the single atomic entry point for voting.
--
-- Records participation (one per resident) and moves anonymous counters, in one
-- transaction, without ever linking a resident to their choice. Called through
-- the user's session so auth.uid() / current_resident_id() identify the caller.
-- =====================================================================
create or replace function cast_vote(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_on_behalf_resident_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote  votes%rowtype;
  v_voter text;
  v_by    uuid := auth.uid();
  v_now   timestamptz := now();
  v_count int;
  v_valid int;
begin
  if v_by is null then
    raise exception 'לא מחובר';
  end if;

  -- Serialize concurrent casts on the same vote.
  select * into v_vote from votes where id = p_vote_id for update;
  if not found then
    raise exception 'ההצבעה לא נמצאה';
  end if;

  -- Who is voting, and may the caller do it?
  if p_on_behalf_resident_id is not null then
    if not (
      is_admin()
      or exists (
        select 1 from vote_committee vc
        where vc.vote_id = p_vote_id and vc.resident_id = current_resident_id()
      )
    ) then
      raise exception 'רק חבר ועדת קלפי רשאי להזין הצבעה עבור תושב אחר';
    end if;
    v_voter := p_on_behalf_resident_id;
    if not exists (select 1 from residents where id = v_voter) then
      raise exception 'התושב לא נמצא';
    end if;
  else
    v_voter := current_resident_id();
    if v_voter is null then
      raise exception 'רק תושב רשום רשאי להצביע';
    end if;
  end if;

  -- The vote must be open: started, not closed, and (scheduled) not past its time.
  if v_now < v_vote.start_at then
    raise exception 'ההצבעה טרם נפתחה';
  end if;
  if v_vote.closed_at is not null then
    raise exception 'ההצבעה נסגרה';
  end if;
  if v_vote.closure_mode = 'scheduled'
     and v_vote.closes_at is not null
     and v_now >= v_vote.closes_at then
    raise exception 'ההצבעה נסגרה';
  end if;

  -- Validate the selection.
  v_count := coalesce(array_length(p_option_ids, 1), 0);
  if v_count < 1 then
    raise exception 'יש לבחור לפחות אפשרות אחת';
  end if;
  if v_count > v_vote.max_selections then
    raise exception 'נבחרו יותר מדי אפשרויות';
  end if;
  select count(distinct o.id) into v_valid
    from vote_options o
   where o.vote_id = p_vote_id and o.id = any (p_option_ids);
  if v_valid <> v_count then
    raise exception 'בחירה לא חוקית';
  end if;

  -- One vote per resident.
  begin
    insert into vote_participants (vote_id, resident_id, voted_by_user_id)
    values (
      p_vote_id,
      v_voter,
      case when p_on_behalf_resident_id is not null then v_by else null end
    );
  exception when unique_violation then
    raise exception 'התושב כבר הצביע בהצבעה זו';
  end;

  -- Move the anonymous counters. The choice is never stored against the voter.
  update vote_tallies t
     set count = t.count + 1
   where t.option_id = any (p_option_ids);
end;
$$;
