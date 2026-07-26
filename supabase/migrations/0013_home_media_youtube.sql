-- =====================================================================
-- Home media: support YouTube videos (from the community's own channel) as a
-- third media kind, so hero videos aren't limited by the Storage file-size cap.
-- A YouTube item carries a video id and no uploaded file; image/video items keep
-- their file_path as before.
-- =====================================================================

alter table home_media add column if not exists youtube_id text;
alter table home_media alter column file_path drop not null;

-- Allow kind = 'youtube'.
alter table home_media drop constraint if exists home_media_kind_check;
alter table home_media
  add constraint home_media_kind_check check (kind in ('image', 'video', 'youtube'));

-- Integrity: a youtube item needs a video id; an uploaded item needs a file.
alter table home_media drop constraint if exists home_media_source_check;
alter table home_media
  add constraint home_media_source_check check (
    (kind = 'youtube' and youtube_id is not null)
    or (kind in ('image', 'video') and file_path is not null)
  );
