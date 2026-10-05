import { createAdminClient } from "./supabase/admin";
import type { ImageBucket } from "./images";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signed URLs for stored images, keyed by path. Callers must only pass paths
 * the viewer is allowed to see (i.e. from rows they fetched through RLS) —
 * the admin client signs anything it's given.
 */
export async function signImages(bucket: ImageBucket, paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  const { data } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

export async function deleteImage(bucket: ImageBucket, path: string | null) {
  if (!path) return;
  await createAdminClient().storage.from(bucket).remove([path]);
}
