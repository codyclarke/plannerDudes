"use client";

import { useRef } from "react";
import { cn } from "@/components/ui";

/**
 * Cover photo slot: an "add a photo" target when empty, otherwise the image
 * with Change / Remove buttons. Uploading is the parent's job (onPick).
 */
export default function CoverPicker({
  imageUrl,
  busy,
  onPick,
  onRemove,
  emptyStyle = "large",
  className,
}: {
  imageUrl: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  /** "pill": with no image, show a small button instead of a full-size drop target. */
  emptyStyle?: "large" | "pill";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.click();

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-picking the same file
        if (file) onPick(file);
      }}
    />
  );

  if (!imageUrl && emptyStyle === "pill") {
    return (
      <>
        {fileInput}
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className={cn(
            "rounded-full bg-surface/70 px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-line backdrop-blur transition hover:text-foreground active:scale-95",
            className
          )}
        >
          {busy ? "Uploading…" : "📷 Add cover photo"}
        </button>
      </>
    );
  }

  return (
    <div className={cn("relative aspect-[16/7] w-full overflow-hidden rounded-3xl", className)}>
      {fileInput}

      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed/blob URLs; next/image optimization adds nothing here */}
          <img src={imageUrl} alt="Event cover" className="size-full object-cover" />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={busy}
              className="rounded-full bg-black/55 px-3.5 py-1.5 text-sm font-bold text-white backdrop-blur transition hover:bg-black/70 active:scale-95"
            >
              📷 Change
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="rounded-full bg-black/55 px-3.5 py-1.5 text-sm font-bold text-white backdrop-blur transition hover:bg-black/70 active:scale-95"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy}
          className="flex size-full flex-col items-center justify-center gap-1 border-2 border-dashed border-line bg-surface-2 text-muted transition hover:border-violet-400 hover:text-violet-600 rounded-3xl"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-bold">Add a cover photo</span>
          <span className="text-xs">Optional</span>
        </button>
      )}

      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
          <span className="animate-pulse font-bold">Uploading…</span>
        </div>
      )}
    </div>
  );
}
