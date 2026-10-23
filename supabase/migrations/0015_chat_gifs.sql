-- GIFs in the event chat (picked from GIPHY). A message stores the GIF's
-- link and size only — GIPHY hosts the file. Text becomes optional when a
-- GIF is attached. Run once in the Supabase SQL editor.

alter table event_messages add column if not exists gif jsonb;

-- Was: body between 1 and 1000 characters.
alter table event_messages drop constraint if exists event_messages_body_check;
alter table event_messages add constraint event_messages_body_check
  check (char_length(body) <= 1000 and (char_length(body) > 0 or gif is not null));
