"use client";

import { formatWhen } from "@/lib/format";
import { useState } from "react";
import { useRouter } from "next/navigation";

type OptionWithVote = {
  id: string;
  startsAt: string;
  label: string | null;
  myResponse: "yes" | "maybe" | "no" | null;
  myAdults: number;
  myKids: number;
};

export default function VoteForm({
  eventId,
  options,
}: {
  eventId: string;
  options: OptionWithVote[];
}) {
  const router = useRouter();
  // Unanswered options start as null (no radio selected) and are not
  // submitted, so untouched times don't silently count as a "yes".
  const [answers, setAnswers] = useState<
    Record<string, { response: "yes" | "maybe" | "no" | null; adults: number; kids: number }>
  >(
    Object.fromEntries(
      options.map((o) => [o.id, { response: o.myResponse, adults: o.myAdults, kids: o.myKids }])
    )
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(
    optionId: string,
    patch: Partial<{ response: "yes" | "maybe" | "no"; adults: number; kids: number }>
  ) {
    setAnswers((prev) => ({ ...prev, [optionId]: { ...prev[optionId], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const answered = options.filter((o) => answers[o.id].response !== null);
    if (answered.length === 0) {
      setError("Pick yes, maybe, or no for at least one time.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        votes: answered.map((o) => ({
          eventOptionId: o.id,
          response: answers[o.id].response,
          adultsCount: answers[o.id].adults,
          kidsCount: answers[o.id].kids,
        })),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not save your vote.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {options.map((o) => (
        <div key={o.id} className="rounded border p-3">
          <p className="font-medium">
            {o.label ? `${o.label} — ` : ""}
            {formatWhen(o.startsAt)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex gap-3">
              {(["yes", "maybe", "no"] as const).map((r) => (
                <label key={r} className="flex items-center gap-1 capitalize">
                  <input
                    type="radio"
                    name={`response-${o.id}`}
                    checked={answers[o.id].response === r}
                    onChange={() => update(o.id, { response: r })}
                  />
                  {r}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-1">
              +adults
              <input
                type="number"
                min={0}
                max={20}
                value={answers[o.id].adults}
                onChange={(e) => update(o.id, { adults: Number(e.target.value) })}
                className="w-16 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1">
              +kids
              <input
                type="number"
                min={0}
                max={20}
                value={answers[o.id].kids}
                onChange={(e) => update(o.id, { kids: Number(e.target.value) })}
                className="w-16 rounded border px-2 py-1"
              />
            </label>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="self-start rounded bg-black px-3 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save my vote"}
      </button>
    </form>
  );
}
