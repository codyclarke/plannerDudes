"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWhen } from "@/lib/format";
import { Button, Card, Chip, ErrorText, cn } from "@/components/ui";
import type { OptionView } from "./event-view";

export default function FinalizeControl({
  eventId,
  options,
  topOptionId,
}: {
  eventId: string;
  options: OptionView[];
  topOptionId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(topOptionId ?? options[0]?.id ?? "");
  // Locking in notifies everyone, so it takes a second tap to confirm.
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinalize() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventOptionId: selected }),
    });
    setLoading(false);
    if (!res.ok) {
      setConfirming(false);
      setError("Couldn't lock in this date — try again.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border-2 border-dashed border-violet-400/50 bg-violet-500/5 ring-0">
      <p className="font-display text-lg font-semibold">👑 Organizer: lock it in</p>
      <p className="text-sm text-muted">Pick the winner. Everyone gets notified and can add it to their calendar.</p>

      <div className="mt-4 flex flex-col gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected === o.id}
            onClick={() => {
              setSelected(o.id);
              setConfirming(false);
            }}
            className={cn(
              "flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition",
              selected === o.id ? "bg-surface ring-2 ring-violet-500" : "bg-surface/60 ring-line"
            )}
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full ring-2",
                selected === o.id ? "bg-violet-600 ring-violet-600" : "ring-line"
              )}
            >
              {selected === o.id && <span className="size-2 rounded-full bg-white" />}
            </span>
            <span className="flex-1">
              <span className="block font-bold">{formatWhen(o.startsAt, o.allDay)}</span>
              <span className="text-xs font-semibold text-muted">
                {o.yes} yes · {o.maybe} maybe · 👥 {o.totalAttendees}
              </span>
            </span>
            {o.id === topOptionId && <Chip tone="amber">🏆</Chip>}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {confirming ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-[2]" onClick={handleFinalize} disabled={loading}>
            {loading ? "Locking in…" : "Yes, notify everyone"}
          </Button>
        </div>
      ) : (
        <Button full className="mt-4" onClick={() => setConfirming(true)} disabled={!selected}>
          🔒 Lock in this date
        </Button>
      )}
    </Card>
  );
}
