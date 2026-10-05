"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cn, inputClasses } from "@/components/ui";
import { endOfDayIso, type Deadline } from "@/lib/voting-deadline";

/**
 * Voting-deadline banner above the vote cards. Organizers can set, move or
 * remove the deadline from here (moving it later reopens closed voting).
 */
export default function DeadlineBanner({
  eventId,
  deadline,
  closesOnDate,
  isOrganizer,
}: {
  eventId: string;
  deadline: Deadline | null;
  /** Current closing day as "YYYY-MM-DD", to prefill the editor. */
  closesOnDate: string | null;
  isOrganizer: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(closesOnDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deadline && !isOrganizer) return null;

  async function save(value: string | null) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/voting-close`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votingClosesAt: value ? endOfDayIso(value) : null }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Couldn't save — try again.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const tone = !deadline
    ? "bg-surface-2 text-muted"
    : deadline.closed
      ? "bg-surface-2 text-foreground"
      : deadline.urgent
        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
        : "bg-violet-500/10 text-violet-800 dark:text-violet-200";

  return (
    <div className={cn("rounded-3xl px-4 py-3", tone)}>
      {!editing ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-bold">
            {!deadline
              ? "⏳ No voting deadline"
              : deadline.closed
                ? `🔒 ${deadline.long}${isOrganizer ? " — lock in a date below." : " — the organizer is picking the date."}`
                : `⏳ ${deadline.long}`}
          </p>
          {isOrganizer && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto text-sm font-bold text-violet-600 underline-offset-2 hover:underline dark:text-violet-300"
            >
              {deadline ? (deadline.closed ? "Reopen" : "Change") : "Set one"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">Voting closes at the end of:</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(inputClasses, "px-3")}
          />
          {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(date)} disabled={!date || saving}>
              {saving ? "Saving…" : "Save deadline"}
            </Button>
            {deadline && (
              <Button variant="ghost" onClick={() => save(null)} disabled={saving}>
                Remove deadline
              </Button>
            )}
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
