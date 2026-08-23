-- =====================================================================
-- "רגעים שזוכרים" — a sub-section of קהילה for historic community events.
--
-- Each moment is a link to an external video/media: a YouTube video, a Google
-- Drive file, a Bunny Stream video, or any other public URL. Unlike
-- community_items these are links only (no uploaded files, no storage bucket).
-- `provider` says how to embed it; `ref` holds the piece we need per provider:
--   youtube -> the 11-char video id
--   drive   -> the Drive file id
--   bunny   -> the video GUID
--   link    -> the full external URL (opened in a new tab; never embedded)
-- =====================================================================

create table if not exists community_moments (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null default '',
  description text not null default '',
  provider    text not null check (provider in ('youtube', 'drive', 'bunny', 'link')),
  ref         text not null,
  event_date  date,                             -- when the event happened (optional)
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,       -- gallery order (lower first)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table community_moments is 'פריטי „רגעים שזוכרים” — קישורי וידאו/מדיה לאירועים היסטוריים, בניהול אדמין.';

create index if not exists community_moments_visible_idx on community_moments (is_visible, sort_order);

-- RLS mirrors community_items: authenticated may read only visible moments; only
-- admin writes. Reads run server-side with the service role, but keep the table
-- safe if ever read through a user client.
alter table community_moments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'community_moments' and policyname = 'moments_select_visible') then
    create policy moments_select_visible on community_moments
      for select to authenticated using (is_visible = true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'community_moments' and policyname = 'moments_admin_all') then
    create policy moments_admin_all on community_moments
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists community_moments_updated_at on community_moments;
create trigger community_moments_updated_at
  before update on community_moments
  for each row execute function set_updated_at();
