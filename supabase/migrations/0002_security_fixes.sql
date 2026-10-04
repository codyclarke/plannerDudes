-- Security fixes on top of 0001. Run once in the Supabase SQL editor.

-- Users could update any column of their own profile, including is_owner
-- and group_id. Nothing in the app edits profiles, so drop the policy.
drop policy if exists profiles_update_own on profiles;

-- Views run with their owner's rights by default, bypassing RLS; this one
-- was readable by anyone holding the anon key. Make it respect the caller's
-- RLS (it then only shows tallies for events the caller can see).
alter view event_option_tallies set (security_invoker = true);

-- Security-definer functions should pin search_path so a caller can't
-- shadow `profiles` / `events` with objects in another schema.
alter function my_group_id() set search_path = public;
alter function am_event_participant(uuid) set search_path = public;

-- Votes may only be cast/changed while the event is still polling.
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
        and e.status = 'polling'
        and am_event_participant(e.id)
    )
  );
