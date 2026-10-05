// Browser-only: shrink a picked photo and upload it to a storage bucket.
import { createClient } from "@/lib/supabase/client";
import type { ImageBucket } from "@/lib/images";

type ShrinkOptions = {
  /** Longest side (or square edge when `square`), in px. */
  maxDimension: number;
  /** Center-crop to a square first (avatars). */
  square?: boolean;
};

export const COVER_IMAGE: ShrinkOptions = { maxDimension: 1600 };
export const AVATAR_IMAGE: ShrinkOptions = { maxDimension: 512, square: true };

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // browsers apply EXIF orientation when drawing
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Downscale (optionally center-cropping to a square) and re-encode. This
 * keeps uploads small/fast and turns formats like iPhone HEIC into WebP/JPEG.
 */
async function shrink(file: File, opts: ShrinkOptions): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const img = await loadImage(file);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  // Source rectangle: the whole image, or its centered square.
  const side = Math.min(w, h);
  const [sx, sy, sw, sh] = opts.square ? [(w - side) / 2, (h - side) / 2, side, side] : [0, 0, w, h];

  const scale = Math.min(1, opts.maxDimension / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // Safari can't encode WebP and silently returns PNG instead, so check the
  // result type and fall back to JPEG.
  const webp = await canvasToBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("Couldn't process that image.");
  return { blob: jpeg, ext: "jpg" };
}

/** Uploads a photo into the caller's folder; returns its storage path and a local preview URL. */
export async function uploadImage(bucket: ImageBucket, file: File, opts: ShrinkOptions) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("You're signed out — log in again.");

  let processed;
  try {
    processed = await shrink(file, opts);
  } catch {
    throw new Error("Couldn't read that image — try a JPEG or PNG.");
  }

  const path = `${auth.user.id}/${crypto.randomUUID()}.${processed.ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, processed.blob, { contentType: processed.blob.type, upsert: false });
  if (error) throw new Error("Upload failed — try again.");

  return { path, previewUrl: URL.createObjectURL(processed.blob) };
}

/** Best-effort cleanup of an upload that ended up unused. */
export async function discardImage(bucket: ImageBucket, path: string) {
  await createClient().storage.from(bucket).remove([path]);
}
