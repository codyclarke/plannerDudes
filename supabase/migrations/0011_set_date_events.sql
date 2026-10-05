-- "Set date" events (birthday, festival…): created already locked in, with
-- RSVPs instead of a date vote. Run once in the Supabase SQL editor.

-- True when the organizer picked the date up front instead of polling.
alter table events add column if not exists fixed_date boolean not null default false;

-- RSVP nudges for set-date events: push to anyone who hasn't answered,
-- 3 days before and the day before (each at most once per event).
alter table notifications_log drop constraint if exists notifications_log_type_check;
alter table notifications_log add constraint notifications_log_type_check
  check (type in (
    'created', 'finalized', 'reminder',
    'nudge_3d', 'nudge_1d', 'nudge_today', 'voting_closed',
    'rsvp_3d', 'rsvp_1d'
  ));
