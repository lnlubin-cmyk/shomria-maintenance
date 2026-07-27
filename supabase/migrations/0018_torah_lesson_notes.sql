-- Add a Notes (הערות) field to Torah lessons — free text.
alter table torah_lessons add column if not exists notes text not null default '';
