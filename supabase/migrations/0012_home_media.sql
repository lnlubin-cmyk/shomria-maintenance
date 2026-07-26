-- =====================================================================
-- Home-page media carousel — admin-managed images/videos that play in the
-- hero, one after another. Admins upload several and mark each active/disabled;
-- the home page cycles through the active ones in order.
--
-- Files live in a PUBLIC bucket (hero content is shown to every visitor,
-- including logged-out ones). Uploads go browser -> Storage directly via a
-- signed upload URL, so large videos don't pass through the serverless function.
-- =====================================================================

create table if not exists home_media (
  id          uuid primary key default uuid_generate_v4(),
  kind        text not null check (kind in ('image', 'video')),
  file_path   text not null,                    -- storage key in 'home-media'
  file_name   text,                             -- original filename
  mime_type   text,
  is_active   boolean not null default true,    -- plays on the home page when true
  sort_order  integer not null default 0,       -- playback order (lower first)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table home_media is 'מדיה לקרוסלה בדף הבית (תמונות/וידאו) בניהול אדמין.';

create index if not exists home_media_active_idx on home_media (is_active, sort_order, created_at);

-- RLS: everyone (incl. logged-out) may read ACTIVE media; only admin writes.
alter table home_media enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'home_media' and policyname = 'home_media_select_active') then
    create policy home_media_select_active on home_media
      for select to public using (is_active = true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'home_media' and policyname = 'home_media_admin_all') then
    create policy home_media_admin_all on home_media
      for all to authenticated using (is_admin()) with check (is_admin());
  end if;
end $$;

drop trigger if exists home_media_updated_at on home_media;
create trigger home_media_updated_at
  before update on home_media
  for each row execute function set_updated_at();

-- Public bucket for the media (images + common web video), 50MB cap.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-media', 'home-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/ogg']
)
on conflict (id) do nothing;
