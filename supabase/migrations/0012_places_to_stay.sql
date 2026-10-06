-- "Where should we stay?" — pasted links (Airbnb, VRBO, hotels…) that the
-- group votes on. Run once in the Supabase SQL editor.

create table if not exists event_places (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  url text not null,
  -- Link preview (og: tags) fetched when added; title can be renamed.
  title text,
  description text,
  image_url text,
  site_name text,
  added_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, url)
);

create table if not exists place_votes (
  place_id uuid not null references event_places(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (place_id, profile_id)
);

-- The place the organizer picked (null until then).
alter table events add column if not exists chosen_place_id uuid
  references event_places(id) on delete set null;

alter table event_places enable row level security;
alter table place_votes enable row level security;

-- Anyone in the event's group can see and add places; the person who added
-- a place (or the event's organizer) can rename or remove it.
drop policy if exists event_places_select on event_places;
create policy event_places_select on event_places for select
  using (am_event_participant(event_id));

drop policy if exists event_places_insert on event_places;
create policy event_places_insert on event_places for insert
  with check (added_by = auth.uid() and am_event_participant(event_id));

drop policy if exists event_places_modify on event_places;
create policy event_places_modify on event_places for update
  using (
    added_by = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
  );

drop policy if exists event_places_delete on event_places;
create policy event_places_delete on event_places for delete
  using (
    added_by = auth.uid()
    or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
  );

-- Everyone in the group sees all place votes (for tallies); people only
-- write their own.
drop policy if exists place_votes_select on place_votes;
create policy place_votes_select on place_votes for select
  using (exists (
    select 1 from event_places p where p.id = place_id and am_event_participant(p.event_id)
  ));

drop policy if exists place_votes_write_own on place_votes;
create policy place_votes_write_own on place_votes for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from event_places p where p.id = place_id and am_event_participant(p.event_id))
  );
