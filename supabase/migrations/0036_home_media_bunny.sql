-- =====================================================================
-- Home media: support Bunny Stream videos as a fourth kind, so hero videos can
-- be hosted on Bunny (no Storage size cap, adaptive delivery) instead of
-- YouTube. A bunny item carries the video GUID; it has no uploaded file.
-- =====================================================================

alter table home_media add column if not exists bunny_video_id text;

-- Allow kind = 'bunny'.
alter table home_media drop constraint if exists home_media_kind_check;
alter table home_media
  add constraint home_media_kind_check check (kind in ('image', 'video', 'youtube', 'bunny'));

-- Integrity: each kind carries its own source reference.
alter table home_media drop constraint if exists home_media_source_check;
alter table home_media
  add constraint home_media_source_check check (
    (kind = 'youtube' and youtube_id is not null)
    or (kind = 'bunny' and bunny_video_id is not null)
    or (kind in ('image', 'video') and file_path is not null)
  );
