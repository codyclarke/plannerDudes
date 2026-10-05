-- Each event gets an emoji shown on its card (picked by the organizer,
-- auto-suggested from the title). Run once in the Supabase SQL editor.
alter table events add column if not exists emoji text;
