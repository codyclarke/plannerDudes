-- Profile pictures. Run once in the Supabase SQL editor.

-- Path inside the avatars bucket ("<user id>/<uuid>.webp"). Written only by
-- the /api/profile/avatar route (service role): users have no update policy
-- on profiles, so they can't touch other columns like is_owner.
alter table profiles add column if not exists avatar_path text;

-- Private bucket, same model as event-images: viewers get short-lived signed
-- URLs from the server. Avatars are cropped to 512px client-side, so 2 MB is plenty.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Users may upload / read / delete only within their own folder.
drop policy if exists "avatars: upload to own folder" on storage.objects;
create policy "avatars: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: read own folder" on storage.objects;
create policy "avatars: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: delete own folder" on storage.objects;
create policy "avatars: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
