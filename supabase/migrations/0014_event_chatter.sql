-- "Chatter": a group conversation on each event (hype, ideas, logistics),
-- with emoji reactions, 💡 ideas the organizer can pin, @mentions and
-- unread badges. Run once in the Supabase SQL editor.

create table if not exists event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_idea boolean not null default false,
  -- Set by the organizer / app owner to pin an idea to the top.
  pinned_at timestamptz,
  -- People @mentioned in the body (they get a push).
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists event_messages_event_idx on event_messages (event_id, created_at desc);

create table if not exists message_reactions (
  message_id uuid not null references event_messages(id) on delete cascade,
  -- Copied from the message so live updates can be filtered per event.
  event_id uuid not null references events(id) on delete cascade,
  reactor_id uuid not null references profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, reactor_id, emoji)
);

create index if not exists message_reactions_event_idx on message_reactions (event_id);

-- When each person last looked at an event's chat (for "3 new" badges).
create table if not exists event_reads (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

alter table event_messages enable row level security;
alter table message_reactions enable row level security;
alter table event_reads enable row level security;

-- Everyone in the group reads the chat and posts as themselves. Edits,
-- pins and deletes go through the API (author / organizer / app owner
-- checks there), so there are no update/delete policies.
drop policy if exists event_messages_select on event_messages;
create policy event_messages_select on event_messages for select
  using (am_event_participant(event_id));

drop policy if exists event_messages_insert on event_messages;
create policy event_messages_insert on event_messages for insert
  with check (author_id = auth.uid() and am_event_participant(event_id));

drop policy if exists message_reactions_select on message_reactions;
create policy message_reactions_select on message_reactions for select
  using (am_event_participant(event_id));

drop policy if exists message_reactions_insert on message_reactions;
create policy message_reactions_insert on message_reactions for insert
  with check (
    reactor_id = auth.uid()
    and exists (
      select 1 from event_messages m
      where m.id = message_reactions.message_id and m.event_id = message_reactions.event_id
    )
    and am_event_participant(event_id)
  );

drop policy if exists message_reactions_delete on message_reactions;
create policy message_reactions_delete on message_reactions for delete
  using (reactor_id = auth.uid());

drop policy if exists event_reads_own on event_reads;
create policy event_reads_own on event_reads for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and am_event_participant(event_id));

-- Live updates: stream changes on these tables to signed-in browsers
-- (Supabase Realtime still applies the select policies above).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_messages'
  ) then
    alter publication supabase_realtime add table event_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table message_reactions;
  end if;
end $$;
