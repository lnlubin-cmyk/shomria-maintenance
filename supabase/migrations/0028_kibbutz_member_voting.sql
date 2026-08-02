-- =====================================================================
-- Kibbutz membership: only members may vote.
--
-- residents.is_member marks whether a resident is a kibbutz member. Existing
-- residents default to members (preserving current voting); the admin unmarks
-- non-members. Every voting path (self, committee on-behalf, and marking a
-- manual/paper vote) now requires the voter to be a member.
-- =====================================================================
alter table residents add column if not exists is_member boolean not null default true;
comment on column residents.is_member is 'האם התושב חבר קיבוץ (רק חברים רשאים להצביע).';

create or replace function resident_is_member(p_resident_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_member from residents where id = p_resident_id), false);
$$;

-- ---------------------------------------------------------------------
-- cast_vote — add the members-only check (rest unchanged from 0026).
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

  if not resident_is_member(v_voter) then
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
-- cast_membership_vote — add the members-only check.
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

  if not resident_is_member(v_voter) then
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
-- mark_paper_vote — add the members-only check.
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
