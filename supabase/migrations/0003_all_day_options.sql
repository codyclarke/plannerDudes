-- Candidate times can be date-only ("all day"). Run once in the Supabase SQL editor.
--
-- For all-day options, starts_at holds 12:00 UTC on that date. Noon UTC is the
-- same calendar date in every timezone from UTC-11 to UTC+11, so the date can
-- be read back from the UTC date part without timezone drift, and ordering /
-- comparisons on starts_at keep working unchanged.
alter table event_options add column all_day boolean not null default false;
