-- Add the lecturer (מעביר השיעור) field to Torah lessons — free text.
alter table torah_lessons add column if not exists lecturer text not null default '';
