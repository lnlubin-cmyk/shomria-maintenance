-- Drop the info-panels subsystem. Run ONLY after the info-panels-free code is
-- deployed and verified — 0055 already copied the data into community_items and
-- the files remain in the shared 'community' bucket, so nothing else is lost.
drop table if exists info_panels;
drop table if exists store_info; -- orphaned legacy predecessor (see 0040)
