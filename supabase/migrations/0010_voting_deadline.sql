-- Voting closing date + vote nudges. Run once in the Supabase SQL editor.

-- When voting stops (end of the chosen day). Null = no deadline.
alter table events add column if not exists voting_closes_at timestamptz;

-- New notification kinds, each sent at most once per event (unique
-- (event_id, type)): push nudges to non-voters 3 days / 1 day / the morning
-- before voting closes, and a heads-up to the organizer once it has closed.
alter table notifications_log drop constraint if exists notifications_log_type_check;
alter table notifications_log add constraint notifications_log_type_check
  check (type in ('created', 'finalized', 'reminder', 'nudge_3d', 'nudge_1d', 'nudge_today', 'voting_closed'));

-- Votes are accepted while polling AND before the closing date (if any);
-- after lock-in, only RSVPs on the locked-in date (unchanged from 0008).
drop policy if exists votes_write_own on votes;
create policy votes_write_own on votes for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from event_options eo
      join events e on e.id = eo.event_id
      where eo.id = event_option_id
        and am_event_participant(e.id)
        and (
          (e.status = 'polling' and (e.voting_closes_at is null or now() < e.voting_closes_at))
          or (e.status = 'finalized' and e.finalized_option_id = eo.id)
        )
    )
  );
