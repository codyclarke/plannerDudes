"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, cn, inputClasses } from "@/components/ui";

/** Your display name with an inline "✏️ Edit" (doesn't change your login). */
export default function NameEditor({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setEditing(false);
    setDraft(name);
    setError(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (next === name) return cancel();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/profile/name", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: next }),
    });
    setSaving(false);
    if (!res.ok) {
      // 400 / 409 carry a readable reason ("already called …").
      const body = res.status === 400 || res.status === 409 ? await res.json().catch(() => null) : null;
      setError(body?.error ?? "Couldn't save your name — try again.");
      return;
    }
    setEditing(false);
    router.refresh(); // header avatar initials, etc.
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        <p className="min-w-0 truncate font-display text-xl font-semibold">{name}</p>
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          aria-label="Edit display name"
          className="shrink-0 text-sm font-bold text-muted transition hover:text-foreground"
        >
          ✏️ Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2">
      <label className="text-left text-xs font-extrabold tracking-wide text-muted uppercase" htmlFor="display-name">
        Display name
      </label>
      <input
        id="display-name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && cancel()}
        maxLength={40}
        autoFocus
        autoComplete="nickname"
        className={cn(inputClasses, "py-2")}
      />
      <p className="text-left text-xs font-semibold text-muted">This is what the group sees. Your login doesn&apos;t change.</p>
      {error && <p className="text-left text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={cancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !draft.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
