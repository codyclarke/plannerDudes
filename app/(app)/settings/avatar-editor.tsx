"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_IMAGE, discardImage, uploadImage } from "@/lib/upload-image";
import { AVATARS_BUCKET } from "@/lib/images";
import { Avatar } from "@/components/ui";

/** Settings profile card: photo with change/remove controls, name and email. */
export default function AvatarEditor({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(avatarPath: string | null) {
    const res = await fetch("/api/profile/avatar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarPath }),
    });
    return res.ok;
  }

  async function pick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { path } = await uploadImage(AVATARS_BUCKET, file, AVATAR_IMAGE);
      if (await save(path)) {
        router.refresh();
      } else {
        await discardImage(AVATARS_BUCKET, path);
        setError("Couldn't update your photo — try again.");
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
    else setError("Couldn't remove your photo — try again.");
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-picking the same file
          if (file) pick(file);
        }}
      />
      <button
        type="button"
        aria-label="Change profile photo"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative shrink-0 rounded-full transition active:scale-95"
      >
        <Avatar name={name} src={avatarUrl} size="xl" />
        <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-linear-to-br from-violet-600 to-fuchsia-500 text-sm text-white shadow-md ring-2 ring-surface transition group-hover:scale-110">
          📷
        </span>
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-background/70 text-xs font-bold backdrop-blur-sm">
            …
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-semibold">{name}</p>
        {email && <p className="truncate text-sm text-muted">{email}</p>}
        <div className="mt-2 flex justify-center gap-3 text-sm font-bold sm:justify-start">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="text-violet-600 dark:text-violet-300"
          >
            {avatarUrl ? "Change photo" : "Add a photo"}
          </button>
          {avatarUrl && (
            <button type="button" onClick={remove} disabled={busy} className="text-muted hover:text-rose-500">
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
