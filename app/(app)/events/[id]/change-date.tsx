"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allDayDateKey } from "@/lib/format";
import { Button, cn, inputClasses } from "@/components/ui";

/** Organizer control on a set-date event: move the date (everyone is notified). */
export default function ChangeDate({
  eventId,
  startsAt,
  allDay,
}: {
  eventId: string;
  startsAt: string;
  allDay: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Prefill with the current date (and time, in the browser's zone).
  const [date, setDate] = useState(() =>
    allDay ? allDayDateKey(startsAt) : new Date(startsAt).toLocaleDateString("en-CA")
  );
  const [time, setTime] = useState(() =>
    allDay
      ? ""
      : new Date(startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/date`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Same conversion as the create form: timed dates become an instant
        // in the browser's zone; all-day dates send just the date.
        date: time ? { allDay: false, startsAt: new Date(`${date}T${time}`).toISOString() } : { allDay: true, date },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Couldn't change the date — try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-violet-600 underline-offset-2 hover:underline dark:text-violet-300"
      >
        📅 Change date
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <p className="text-sm font-bold">New date (time optional)</p>
      <div className="flex gap-2">
        <input
          type="date"
          aria-label="New date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={cn(inputClasses, "min-w-0 flex-[3] px-3")}
        />
        <input
          type="time"
          aria-label="New time (optional)"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={cn(inputClasses, "min-w-0 flex-[2] px-3")}
        />
      </div>
      <p className="text-xs text-muted">Everyone gets an email and push with the new date. RSVPs carry over.</p>
      {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={!date || saving}>
          {saving ? "Saving…" : "Move it & notify everyone"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
