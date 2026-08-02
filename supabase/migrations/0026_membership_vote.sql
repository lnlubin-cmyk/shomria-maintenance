-- =====================================================================
-- New vote format: 'membership' (הצבעה לחברות) — approve candidates joining the
-- kibbutz. The admin lists family names (free text, up to 20). Each voter
-- accepts or declines EVERY name. Same rules as other votes (secret ballot,
-- one per resident, proxy, manual counting + approval, closure).
--
-- Each name is a vote_option; it carries two anonymous counters: accept uses the
-- existing vote_tallies.count, decline uses a new vote_tallies.decline_count.
-- The manual (paper) counts mirror that on vote_paper_counts.
-- =====================================================================

-- Allow the new format (drop whatever check currently constrains votes.format).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'votes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%format%'
  loop
    execute format('alter table votes drop constraint %I', c);
  end loop;
  alter table votes add constraint votes_format_check
    check (format in ('options', 'election', 'membership'));
end $$;

-- Decline counters (accept side reuses the existing "count").
alter table vote_tallies add column if not exists decline_count int not null default 0;
alter table vote_paper_counts add column if not exists decline_count int not null default 0;

-- ---------------------------------------------------------------------
-- cast_vote: reject membership votes — they must use cast_membership_vote.
-- (Recreated from 0021 with a format guard added.)
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
  if v_vote.format = 'membership' then
    raise exception 'יש להשתמש בהצבעת חברות';
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
-- cast_membership_vote — one accept/decline per candidate, all required.
-- ---------------------------------------------------------------------
create or replace function cast_membership_vote(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_accept boolean[],
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
  v_total int;
  i int;
begin
  if v_by is null then
    raise exception 'לא מחובר';
  end if;

  select * into v_vote from votes where id = p_vote_id for update;
  if not found then
    raise exception 'ההצבעה לא נמצאה';
  end if;
  if v_vote.format <> 'membership' then
    raise exception 'סוג הצבעה שגוי';
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
  if v_count < 1 or v_count <> coalesce(array_length(p_accept, 1), 0) then
    raise exception 'קלט לא תקין';
  end if;
  select count(distinct o.id) into v_valid
    from vote_options o
   where o.vote_id = p_vote_id and o.id = any (p_option_ids);
  if v_valid <> v_count then
    raise exception 'בחירה לא חוקית';
  end if;
  select count(*) into v_total from vote_options where vote_id = p_vote_id;
  if v_count <> v_total then
    raise exception 'יש להצביע עבור כל המועמדים';
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

  for i in 1 .. v_count loop
    if p_accept[i] then
      update vote_tallies set count = count + 1 where option_id = p_option_ids[i];
    else
      update vote_tallies set decline_count = decline_count + 1 where option_id = p_option_ids[i];
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Manual (paper) counts for a membership vote: accept + decline per name.
-- ---------------------------------------------------------------------
create or replace function submit_membership_paper_counts(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_accept int[],
  p_decline int[]
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
  if v_vote.format <> 'membership' then
    raise exception 'סוג הצבעה שגוי';
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
  if v_len <> coalesce(array_length(p_accept, 1), 0) or v_len <> coalesce(array_length(p_decline, 1), 0) then
    raise exception 'קלט לא תקין';
  end if;
  select count(distinct o.id) into v_valid
    from vote_options o
   where o.vote_id = p_vote_id and o.id = any (p_option_ids);
  if v_valid <> v_len then
    raise exception 'בחירה לא חוקית';
  end if;
  for i in 1 .. v_len loop
    if p_accept[i] < 0 or p_decline[i] < 0 then
      raise exception 'מספר קולות לא תקין';
    end if;
  end loop;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count, decline_count)
    select p_vote_id, p_option_ids[g], p_accept[g], p_decline[g]
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
