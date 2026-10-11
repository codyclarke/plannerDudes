-- Emoji reactions on people's "I'm in" RSVPs (Slack-style: several per
-- person, tap again to remove). Run once in the Supabase SQL editor.

create table if not exists rsvp_reactions (
  event_id uuid not null references events(id) on delete cascade,
  -- The person whose RSVP is reacted to, and who reacted.
  target_id uuid not null references profiles(id) on delete cascade,
  reactor_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (event_id, target_id, reactor_id, emoji)
);

create index if not exists rsvp_reactions_event_idx on rsvp_reactions (event_id);

alter table rsvp_reactions enable row level security;

-- Everyone in the event's group sees all reactions; people only add or
-- remove their own.
drop policy if exists rsvp_reactions_select on rsvp_reactions;
create policy rsvp_reactions_select on rsvp_reactions for select
  using (am_event_participant(event_id));

drop policy if exists rsvp_reactions_insert on rsvp_reactions;
create policy rsvp_reactions_insert on rsvp_reactions for insert
  with check (reactor_id = auth.uid() and am_event_participant(event_id));

drop policy if exists rsvp_reactions_delete on rsvp_reactions;
create policy rsvp_reactions_delete on rsvp_reactions for delete
  using (reactor_id = auth.uid());

-- When each person was last pushed about reactions on an event, so a burst
-- of reactions sends one push an hour at most. Server-only (no policies).
create table if not exists reaction_push_log (
  event_id uuid not null references events(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  last_sent_at timestamptz not null default 'epoch',
  primary key (event_id, target_id)
);

alter table reaction_push_log enable row level security;
