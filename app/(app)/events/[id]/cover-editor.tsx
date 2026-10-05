"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COVER_IMAGE, discardImage, uploadImage } from "@/lib/upload-image";
import { EVENT_IMAGES_BUCKET } from "@/lib/images";
import CoverPicker from "@/components/CoverPicker";

/** Organizer-only cover photo control on the event page. */
export default function CoverEditor({ eventId, imageUrl }: { eventId: string; imageUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(imagePath: string | null) {
    const res = await fetch(`/api/events/${eventId}/image`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePath }),
    });
    return res.ok;
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { path } = await uploadImage(EVENT_IMAGES_BUCKET, file, COVER_IMAGE);
      if (await save(path)) {
        router.refresh();
      } else {
        await discardImage(EVENT_IMAGES_BUCKET, path);
        setError("Couldn't update the cover — try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    if (await save(null)) router.refresh();
    else setError("Couldn't remove the cover — try again.");
    setBusy(false);
  }

  return (
    <>
      <CoverPicker
        imageUrl={imageUrl}
        busy={busy}
        onPick={pick}
        onRemove={remove}
        emptyStyle="pill"
        className={imageUrl ? "rounded-none" : undefined}
      />
      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </>
  );
}
