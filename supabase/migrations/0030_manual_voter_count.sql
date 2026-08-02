-- =====================================================================
-- Record how many people voted manually (paper), as part of entering the
-- manual count. Marking individual paper voters (mark_paper_vote) is only
-- possible while the vote is open and also blocks their electronic vote; but a
-- committee that counts paper ballots only after closure needs a way to report
-- the manual turnout. This number feeds the turnout in results and the protocol.
-- =====================================================================
alter table vote_paper_submission
  add column if not exists manual_voters int not null default 0 check (manual_voters >= 0);

-- Recreate the submit functions with a p_manual_voters argument (drop the old
-- 3-arg signatures so there's no ambiguous overload).
drop function if exists submit_paper_counts(uuid, uuid[], int[]);
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
    raise exception 'מספר המצביעים בנייר לא תקין';
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

  delete from vote_paper_approvals where vote_id = p_vote_id;
  if is_vote_committee(p_vote_id) then
    insert into vote_paper_approvals (vote_id, resident_id, user_id)
      values (p_vote_id, current_resident_id(), auth.uid())
      on conflict do nothing;
  end if;
end;
$$;

drop function if exists submit_membership_paper_counts(uuid, uuid[], int[], int[]);
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
    raise exception 'מספר המצביעים בנייר לא תקין';
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
  if is_vote_committee(p_vote_id) then
    insert into vote_paper_approvals (vote_id, resident_id, user_id)
      values (p_vote_id, current_resident_id(), auth.uid())
      on conflict do nothing;
  end if;
end;
$$;
