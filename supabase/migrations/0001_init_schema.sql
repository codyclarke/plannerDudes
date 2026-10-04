-- Friend-group event planner: initial schema + RLS policies.
-- Run this once in the Supabase SQL editor (Studio -> SQL Editor -> New query).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Friend Group',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid not null references groups(id),
  email text not null,
  display_name text not null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id),
  email text not null,
  token text not null unique,
  invited_by uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references profiles(id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id),
  organizer_id uuid not null references profiles(id),
  title text not null,
  description text,
  location text,
  spouses_invited boolean not null default false,
  kids_allowed boolean not null default false,
  status text not null default 'polling' check (status in ('polling', 'finalized', 'cancelled')),
  finalized_option_id uuid,
  created_at timestamptz not null default now()
);

create table event_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  label text,
  sort_order int not null default 0
);

alter table events
  add constraint events_finalized_option_fk
  foreign key (finalized_option_id) references event_options(id);

create table event_invitees (
  event_id uuid not null references events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (event_id, profile_id)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  event_option_id uuid not null references event_options(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  response text not null check (response in ('yes', 'maybe', 'no')),
  adults_count int not null default 0 check (adults_count >= 0),
  kids_count int not null default 0 check (kids_count >= 0),
  updated_at timestamptz not null default now(),
  unique (event_option_id, profile_id)
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in ('created', 'finalized', 'reminder')),
  sent_at timestamptz not null default now(),
  unique (event_id, type)
);

-- ---------------------------------------------------------------------------
-- Tally view
-- ---------------------------------------------------------------------------

create or replace view event_option_tallies as
select
  eo.id as event_option_id,
  eo.event_id,
  count(*) filter (where v.response = 'yes') as yes_count,
  count(*) filter (where v.response = 'maybe') as maybe_count,
  count(*) filter (where v.response = 'no') as no_count,
  coalesce(sum(1 + v.adults_count + v.kids_count) filter (where v.response = 'yes'), 0) as total_attendees
from event_options eo
left join votes v on v.event_option_id = eo.id
group by eo.id, eo.event_id;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function my_group_id() returns uuid
language sql security definer stable as $$
  select group_id from profiles where id = auth.uid()
$$;

create or replace function am_event_participant(eid uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from events e
    where e.id = eid and (
      e.organizer_id = auth.uid()
      or exists (select 1 from event_invitees ei where ei.event_id = eid and ei.profile_id = auth.uid())
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

alter table groups enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table events enable row level security;
alter table event_options enable row level security;
alter table event_invitees enable row level security;
alter table votes enable row level security;
alter table push_subscriptions enable row level security;
alter table notifications_log enable row level security;

create policy groups_select on groups for select
  using (id = my_group_id());

create policy profiles_select on profiles for select
  using (group_id = my_group_id());
create policy profiles_update_own on profiles for update
  using (id = auth.uid());

create policy invites_select on invites for select
  using (group_id = my_group_id());
create policy invites_insert on invites for insert
  with check (group_id = my_group_id() and invited_by = auth.uid());

create policy events_select on events for select
  using (organizer_id = auth.uid() or am_event_participant(id));
create policy events_insert on events for insert
  with check (organizer_id = auth.uid() and group_id = my_group_id());
create policy events_update_own on events for update
  using (organizer_id = auth.uid());

create policy event_options_select on event_options for select
  using (
    am_event_participant(event_id)
    or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid())
  );
create policy event_options_write on event_options for all
  using (exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid()));

create policy event_invitees_select on event_invitees for select
  using (am_event_participant(event_id));
create policy event_invitees_write on event_invitees for all
  using (exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid()))
  with check (exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid()));

create policy votes_select on votes for select
  using (exists (
    select 1 from event_options eo where eo.id = event_option_id and am_event_participant(eo.event_id)
  ));
create policy votes_write_own on votes for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (select 1 from event_options eo where eo.id = event_option_id and am_event_participant(eo.event_id))
  );

create policy push_subs_owner on push_subscriptions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- No client policies on notifications_log: only the service-role key
-- (used from API routes) reads/writes it, and that key bypasses RLS entirely.
