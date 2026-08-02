-- =====================================================================
-- Results are now published only after ועדת קלפי confirms them.
--
-- Closing a vote stops electronic voting but does NOT reveal results. The
-- committee enters the manual (פתק) count if there was one, reviews the results
-- privately, and then EVERY committee member confirms an honesty declaration and
-- approves. Only when all have approved are the results published and the
-- protocol produced. This applies to every vote (with or without paper ballots).
--
-- Changes:
--   * approve_paper_counts no longer requires a manual submission (a vote with no
--     paper ballots is still approved by the committee), but blocks approval if
--     paper voters were marked without their counts entered.
--   * submit_paper_counts / submit_membership_paper_counts no longer auto-approve
--     the enterer — each member must confirm explicitly.
-- =====================================================================

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
    raise exception 'רק חבר ועדת קלפי רשאי לאשר את התוצאות';
  end if;
  -- If paper voters were marked, their counts must be entered before approving.
  if exists (select 1 from vote_participants where vote_id = p_vote_id and method = 'paper')
     and not exists (select 1 from vote_paper_submission where vote_id = p_vote_id) then
    raise exception 'יש להזין את ספירת קולות הפתקים לפני אישור התוצאות';
  end if;

  insert into vote_paper_approvals (vote_id, resident_id, user_id)
    values (p_vote_id, current_resident_id(), auth.uid())
    on conflict (vote_id, resident_id) do nothing;
end;
$$;

-- submit_paper_counts — same as 0030 but without auto-approving the enterer.
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
  if p_manual_voters < 0 then
    raise exception 'מספר המצביעים בפתק לא תקין';
  end if;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count)
    select p_vote_id, p_option_ids[g], p_counts[g]
      from generate_subscripts(p_option_ids, 1) g;

  insert into vote_paper_submission (vote_id, entered_by_user_id, entered_at, manual_voters)
    values (p_vote_id, auth.uid(), now(), p_manual_voters)
    on conflict (vote_id)
      do update set entered_by_user_id = excluded.entered_by_user_id,
                    entered_at = excluded.entered_at,
                    manual_voters = excluded.manual_voters;

  -- Changing the count invalidates any prior confirmations.
  delete from vote_paper_approvals where vote_id = p_vote_id;
end;
$$;

-- submit_membership_paper_counts — same, without auto-approve.
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
  if p_manual_voters < 0 then
    raise exception 'מספר המצביעים בפתק לא תקין';
  end if;

  delete from vote_paper_counts where vote_id = p_vote_id;
  insert into vote_paper_counts (vote_id, option_id, count, decline_count)
    select p_vote_id, p_option_ids[g], p_accept[g], p_decline[g]
      from generate_subscripts(p_option_ids, 1) g;

  insert into vote_paper_submission (vote_id, entered_by_user_id, entered_at, manual_voters)
    values (p_vote_id, auth.uid(), now(), p_manual_voters)
    on conflict (vote_id)
      do update set entered_by_user_id = excluded.entered_by_user_id,
                    entered_at = excluded.entered_at,
                    manual_voters = excluded.manual_voters;

  delete from vote_paper_approvals where vote_id = p_vote_id;
end;
$$;
