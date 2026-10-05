-- Every event is open to the whole group: no per-event invite lists.
-- Run once in the Supabase SQL editor.

-- "Participant" now simply means "member of the event's group". The votes
-- and event_options policies call this, so they become group-wide too.
create or replace function am_event_participant(eid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = eid and e.group_id = my_group_id()
  )
$$;

drop policy if exists events_select on events;
create policy events_select on events for select
  using (group_id = my_group_id());

-- Per-event invite lists are no longer used (this also drops its policies).
drop table if exists event_invitees;
