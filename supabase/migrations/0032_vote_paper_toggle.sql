-- =====================================================================
-- Vote configuration refinements:
--   * allow_proxy_vote now defaults to FALSE (opt-in).
--   * allow_paper_votes — the admin enables/disables manual (פתק) voting per
--     vote. When disabled: no marking during the vote and no count entry after
--     closure (the committee still confirms the results).
--   * The manual count is entered ONCE and cannot be edited afterwards.
--   * The number of manual (פתק) voters is required when any count is entered,
--     so the turnout always reflects the manual ballots.
-- =====================================================================
alter table votes alter column allow_proxy_vote set default false;
alter table votes add column if not exists allow_paper_votes boolean not null default true;
comment on column votes.allow_paper_votes is 'האם מתאפשרת הצבעה ידנית באמצעות פתקים.';

-- mark_paper_vote — only when paper voting is enabled.
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
  if not v_vote.allow_paper_votes then
    raise exception 'הצבעה ידנית בפתקים אינה מאופשרת בהצבעה זו';
  end if;
  if not exists (select 1 from residents where id = p_resident_id) then
    raise exception 'התושב לא נמצא';
  end if;
  if not resident_is_member(p_resident_id) then
    raise exception 'רק חבר קיבוץ רשאי להצביע';
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

-- submit_paper_counts — requires paper voting enabled, a single entry (no edit),
-- and the number of paper voters when any votes were counted.
create or replace function submit_paper_counts(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_counts int[],
  p_manual_voters int default 0
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
  if not v_vote.allow_paper_votes then
    raise exception 'הצבעה ידנית בפתקים אינה מאופשרת בהצבעה זו';
  end if;
  if not (
    v_vote.closed_at is not null
    or (v_vote.closure_mode = 'scheduled' and v_vote.closes_at is not null and v_now >= v_vote.closes_at)
  ) then
    raise exception 'ניתן להזין ספירת קולות רק לאחר סגירת ההצבעה';
  end if;
  if exists (select 1 from vote_paper_submission where vote_id = p_vote_id) then
    raise exception 'ספירת הקולות כבר הוזנה ואינה ניתנת לשינוי';
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
  if p_manual_voters < 0 then
    raise exception 'מספר המצביעים בפתק לא תקין';
  end if;
  if p_manual_voters < 1 and (select bool_or(x > 0) from unnest(p_counts) x) then
    raise exception 'יש להזין את מספר המצביעים בפתק';
  end if;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count)
    select p_vote_id, p_option_ids[g], p_counts[g]
      from generate_subscripts(p_option_ids, 1) g;

  insert into vote_paper_submission (vote_id, entered_by_user_id, entered_at, manual_voters)
    values (p_vote_id, auth.uid(), now(), p_manual_voters);

  delete from vote_paper_approvals where vote_id = p_vote_id;
end;
$$;

-- submit_membership_paper_counts — same guards.
create or replace function submit_membership_paper_counts(
  p_vote_id uuid,
  p_option_ids uuid[],
  p_accept int[],
  p_decline int[],
  p_manual_voters int default 0
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
  if not v_vote.allow_paper_votes then
    raise exception 'הצבעה ידנית בפתקים אינה מאופשרת בהצבעה זו';
  end if;
  if not (
    v_vote.closed_at is not null
    or (v_vote.closure_mode = 'scheduled' and v_vote.closes_at is not null and v_now >= v_vote.closes_at)
  ) then
    raise exception 'ניתן להזין ספירת קולות רק לאחר סגירת ההצבעה';
  end if;
  if exists (select 1 from vote_paper_submission where vote_id = p_vote_id) then
    raise exception 'ספירת הקולות כבר הוזנה ואינה ניתנת לשינוי';
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
  if p_manual_voters < 0 then
    raise exception 'מספר המצביעים בפתק לא תקין';
  end if;
  if p_manual_voters < 1 and (select bool_or(x > 0) from unnest(p_accept || p_decline) x) then
    raise exception 'יש להזין את מספר המצביעים בפתק';
  end if;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count, decline_count)
    select p_vote_id, p_option_ids[g], p_accept[g], p_decline[g]
      from generate_subscripts(p_option_ids, 1) g;

  insert into vote_paper_submission (vote_id, entered_by_user_id, entered_at, manual_voters)
    values (p_vote_id, auth.uid(), now(), p_manual_voters);

  delete from vote_paper_approvals where vote_id = p_vote_id;
end;
$$;
