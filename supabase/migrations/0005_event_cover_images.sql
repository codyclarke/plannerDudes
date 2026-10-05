-- Cover/header images for events. Run once in the Supabase SQL editor.

-- Path of the cover image inside the event-images bucket ("<uploader id>/<uuid>.webp").
alter table events add column if not exists image_path text;

-- Private bucket: images are only reachable through short-lived signed URLs
-- that the server creates for events the viewer can already see (RLS on
-- events). 5 MB cap; the browser downsizes photos well below that first.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Signed-in users may only touch files in their own folder: upload, and
-- read/delete so the app can discard a photo they swapped out before saving
-- (storage's remove() needs select + delete). Everyone else's images are
-- reached only via server-signed URLs.
drop policy if exists "event images: upload to own folder" on storage.objects;
create policy "event images: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "event images: read own folder" on storage.objects;
create policy "event images: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "event images: delete own folder" on storage.objects;
create policy "event images: delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
