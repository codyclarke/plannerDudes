-- Keep RSVPs open after a date is locked in. Run once in the Supabase SQL editor.
--
-- While an event is polling, people can vote on any of its dates. Once it's
-- finalized, they can still change their answer (and headcount) for the
-- locked-in date only — votes on the losing dates stay frozen.
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
          e.status = 'polling'
          or (e.status = 'finalized' and e.finalized_option_id = eo.id)
        )
    )
  );
