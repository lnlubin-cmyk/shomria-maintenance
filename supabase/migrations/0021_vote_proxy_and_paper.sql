-- =====================================================================
-- Votes: configurable proxy voting + paper ballots with committee approval
--
-- 1. votes.allow_proxy_vote — the admin decides, per vote, whether ועדת קלפי
--    may enter an electronic vote on behalf of another resident.
--
-- 2. Paper ballots. A resident may vote on paper: a committee member marks the
--    resident as having voted (turnout only — no choice, no electronic tally).
--    After closure, the papers are counted by hand and a committee member enters
--    the count per option. That manual count must be approved by EVERY committee
--    member (each from their own login) before it is included in the results.
--    The published result of a vote with paper ballots = electronic tallies +
--    the approved manual counts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Proxy toggle
-- ---------------------------------------------------------------------
alter table votes add column if not exists allow_proxy_vote boolean not null default true;
comment on column votes.allow_proxy_vote is
  'האם ועדת קלפי רשאית להזין הצבעה אלקטרונית עבור תושב אחר.';

-- ---------------------------------------------------------------------
-- 2a. How a participation row was created.
-- ---------------------------------------------------------------------
alter table vote_participants add column if not exists method text not null default 'self'
  check (method in ('self', 'proxy', 'paper'));
-- Backfill: rows entered on someone's behalf so far were electronic proxy votes.
update vote_participants set method = 'proxy'
  where voted_by_user_id is not null and method = 'self';

-- ---------------------------------------------------------------------
-- 2b. Paper counting tables. Like vote_tallies, these are results data and
-- carry NO policy for `authenticated`: every read is server-side via the
-- service role (the vote page gates on committee membership + closure), and
-- every write goes through the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------
create table if not exists vote_paper_counts (
  vote_id    uuid not null references votes (id) on delete cascade,
  option_id  uuid not null references vote_options (id) on delete cascade,
  count      int not null default 0 check (count >= 0),
  primary key (vote_id, option_id)
);

create table if not exists vote_paper_submission (
  vote_id            uuid primary key references votes (id) on delete cascade,
  entered_by_user_id uuid references users (id) on delete set null,
  entered_at         timestamptz not null default now()
);

create table if not exists vote_paper_approvals (
  vote_id     uuid not null references votes (id) on delete cascade,
  resident_id text not null references residents (id) on delete cascade,
  user_id     uuid references users (id) on delete set null,
  approved_at timestamptz not null default now(),
  primary key (vote_id, resident_id)
);

alter table vote_paper_counts     enable row level security;
alter table vote_paper_submission enable row level security;
alter table vote_paper_approvals  enable row level security;

-- ---------------------------------------------------------------------
-- Helper: is the caller a ועדת קלפי member of this vote?
-- ---------------------------------------------------------------------
create or replace function is_vote_committee(p_vote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vote_committee
    where vote_id = p_vote_id and resident_id = current_resident_id()
  );
$$;

-- ---------------------------------------------------------------------
-- Update cast_vote: honour the proxy toggle and record the method.
-- ---------------------------------------------------------------------
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

  select * into v_vote from votes where id = p_vote_id for update;
  if not found then
    raise exception 'ההצבעה לא נמצאה';
  end if;

  if p_on_behalf_resident_id is not null then
    if not v_vote.allow_proxy_vote then
      raise exception 'הזנת הצבעה עבור תושב אחר אינה מאופשרת בהצבעה זו';
    end if;
    if not (is_admin() or is_vote_committee(p_vote_id)) then
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

  begin
    insert into vote_participants (vote_id, resident_id, voted_by_user_id, method)
    values (
      p_vote_id,
      v_voter,
      case when p_on_behalf_resident_id is not null then v_by else null end,
      case when p_on_behalf_resident_id is not null then 'proxy' else 'self' end
    );
  exception when unique_violation then
    raise exception 'התושב כבר הצביע בהצבעה זו';
  end;

  update vote_tallies t
     set count = t.count + 1
   where t.option_id = any (p_option_ids);
end;
$$;

-- ---------------------------------------------------------------------
-- Mark a resident as having voted on paper (turnout only, no ballot).
-- Allowed while the vote is open, by a committee member (or admin).
-- ---------------------------------------------------------------------
create or replace function mark_paper_vote(p_vote_id uuid, p_resident_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote votes%rowtype;
  v_now  timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'לא מחובר';
  end if;
  if not (is_admin() or is_vote_committee(p_vote_id)) then
    raise exception 'רק חבר ועדת קלפי רשאי לסמן הצבעה';
  end if;

  select * into v_vote from votes where id = p_vote_id for update;
  if not found then
    raise exception 'ההצבעה לא נמצאה';
  end if;
  if not exists (select 1 from residents where id = p_resident_id) then
    raise exception 'התושב לא נמצא';
  end if;

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

  begin
    insert into vote_participants (vote_id, resident_id, voted_by_user_id, method)
    values (p_vote_id, p_resident_id, auth.uid(), 'paper');
  exception when unique_violation then
    raise exception 'התושב כבר הצביע בהצבעה זו';
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Enter (or re-enter) the manual paper count per option, after closure.
-- Re-entry resets all approvals; the enterer, if a committee member, is
-- recorded as approving their own entry.
-- ---------------------------------------------------------------------
create or replace function submit_paper_counts(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_counts int[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote votes%rowtype;
  v_now  timestamptz := now();
  v_len  int;
  v_valid int;
  i int;
begin
  if auth.uid() is null then
    raise exception 'לא מחובר';
  end if;
  if not (is_admin() or is_vote_committee(p_vote_id)) then
    raise exception 'רק חבר ועדת קלפי רשאי להזין ספירת קולות';
  end if;

  select * into v_vote from votes where id = p_vote_id for update;
  if not found then
    raise exception 'ההצבעה לא נמצאה';
  end if;
  if not (
    v_vote.closed_at is not null
    or (v_vote.closure_mode = 'scheduled' and v_vote.closes_at is not null and v_now >= v_vote.closes_at)
  ) then
    raise exception 'ניתן להזין ספירת קולות רק לאחר סגירת ההצבעה';
  end if;

  v_len := coalesce(array_length(p_option_ids, 1), 0);
  if v_len = 0 then
    raise exception 'לא הוזנו קולות';
  end if;
  if v_len <> coalesce(array_length(p_counts, 1), 0) then
    raise exception 'קלט לא תקין';
  end if;
  select count(distinct o.id) into v_valid
    from vote_options o
   where o.vote_id = p_vote_id and o.id = any (p_option_ids);
  if v_valid <> v_len then
    raise exception 'בחירה לא חוקית';
  end if;
  for i in 1 .. v_len loop
    if p_counts[i] < 0 then
      raise exception 'מספר קולות לא תקין';
    end if;
  end loop;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count)
    select p_vote_id, p_option_ids[g], p_counts[g]
      from generate_subscripts(p_option_ids, 1) g;

  insert into vote_paper_submission (vote_id, entered_by_user_id, entered_at)
    values (p_vote_id, auth.uid(), now())
    on conflict (vote_id)
      do update set entered_by_user_id = excluded.entered_by_user_id, entered_at = excluded.entered_at;

  delete from vote_paper_approvals where vote_id = p_vote_id;
  if is_vote_committee(p_vote_id) then
    insert into vote_paper_approvals (vote_id, resident_id, user_id)
      values (p_vote_id, current_resident_id(), auth.uid())
      on conflict do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- A committee member approves the entered manual count.
-- ---------------------------------------------------------------------
create or replace function approve_paper_counts(p_vote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'לא מחובר';
  end if;
  if not is_vote_committee(p_vote_id) then
    raise exception 'רק חבר ועדת קלפי רשאי לאשר את הספירה';
  end if;
  if not exists (select 1 from vote_paper_submission where vote_id = p_vote_id) then
    raise exception 'טרם הוזנה ספירת קולות לאישור';
  end if;

  insert into vote_paper_approvals (vote_id, resident_id, user_id)
    values (p_vote_id, current_resident_id(), auth.uid())
    on conflict (vote_id, resident_id) do nothing;
end;
$$;
