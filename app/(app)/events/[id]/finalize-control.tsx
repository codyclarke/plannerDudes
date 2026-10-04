"use client";

import { formatWhen } from "@/lib/format";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; starts_at: string; label: string | null };

export default function FinalizeControl({
  eventId,
  options,
}: {
  eventId: string;
  options: Option[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(options[0]?.id ?? "");
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
      setError("Could not finalize this event.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4">
      <p className="font-medium">Organizer: lock in the time</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border px-3 py-2"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label ? `${o.label} — ` : ""}
              {formatWhen(o.starts_at)}
            </option>
          ))}
        </select>
        <button
          onClick={handleFinalize}
          disabled={loading}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Finalizing..." : "Finalize this time"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
