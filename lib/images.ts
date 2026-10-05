// Shared (client + server) bits for uploaded images. Signing/deleting lives
// in images.server.ts because it needs the service-role key.

export const EVENT_IMAGES_BUCKET = "event-images";
export const AVATARS_BUCKET = "avatars";
export type ImageBucket = typeof EVENT_IMAGES_BUCKET | typeof AVATARS_BUCKET;

/**
 * Uploads are written to "<uploader id>/<uuid>.<ext>" (storage RLS only lets
 * users write into their own folder). Server routes accept a path only if it
 * has that shape and belongs to the caller, so nobody can attach another
 * user's file to their event or profile.
 */
export function isOwnImagePath(path: string, userId: string) {
  const escaped = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}/[0-9a-f-]{36}\\.(webp|jpe?g|png|gif)$`).test(path);
}
