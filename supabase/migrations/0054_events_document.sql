-- An event can carry an optional document (a PDF) shown on its full page, while
-- image_path stays the thumbnail used in the carousel card. When the newsletter
-- split saves an event "as PDF", it stores both: a PNG thumbnail + this PDF.
alter table community_events add column if not exists doc_path text;
alter table community_events add column if not exists doc_name text;

comment on column community_events.doc_path is 'מסמך (PDF) לעמוד האירוע המלא (ריק = מציגים את התמונה)';
