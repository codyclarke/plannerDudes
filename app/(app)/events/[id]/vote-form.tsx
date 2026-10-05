"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateParts } from "@/lib/format";
import { AvatarStack, Button, CalendarTile, Chip, ErrorText, Stepper, cn } from "@/components/ui";
import type { OptionView } from "./event-view";

type Response = "yes" | "maybe" | "no";
type Answer = { response: Response | null; adults: number; kids: number };

const CHOICES: { value: Response; label: string; selected: string }[] = [
  { value: "yes", label: "✅ Yes", selected: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" },
  { value: "maybe", label: "🤔 Maybe", selected: "bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30" },
  { value: "no", label: "😢 Can't", selected: "bg-rose-500 text-white shadow-md shadow-rose-500/30" },
];

export default function VoteForm({
  eventId,
  options,
  topOptionId,
  spousesInvited,
  kidsAllowed,
}: {
  eventId: string;
  options: OptionView[];
  topOptionId: string | null;
  spousesInvited: boolean;
  kidsAllowed: boolean;
}) {
  const router = useRouter();
  // Unanswered options start as null (nothing selected) and are not
  // submitted, so untouched dates don't silently count as a "yes".
  const [answers, setAnswers] = useState<Record<string, Answer>>(
    Object.fromEntries(
      options.map((o) => [o.id, { response: o.myResponse, adults: o.myAdults, kids: o.myKids }])
    )
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function update(optionId: string, patch: Partial<Answer>) {
    setStatus("idle");
    setAnswers((prev) => ({ ...prev, [optionId]: { ...prev[optionId], ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const answered = options.filter((o) => answers[o.id].response !== null);
    if (answered.length === 0) {
      setError("Tap Yes, Maybe, or Can't on at least one date.");
      return;
    }

    setStatus("saving");
    const res = await fetch(`/api/events/${eventId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        votes: answered.map((o) => {
          const a = answers[o.id];
          // Headcount only applies when attending, and only for the extra
          // people this event actually allows.
          const attending = a.response !== "no";
          return {
            eventOptionId: o.id,
            response: a.response,
            adultsCount: attending && spousesInvited ? a.adults : 0,
            kidsCount: attending && kidsAllowed ? a.kids : 0,
          };
        }),
      }),
    });
    if (!res.ok) {
      setStatus("idle");
      setError("Couldn't save your vote — try again.");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {options.map((o) => {
        const a = answers[o.id];
        const time = dateParts(o.startsAt, o.allDay).time ?? "All day";
        const showHeadcount = (a.response === "yes" || a.response === "maybe") && (spousesInvited || kidsAllowed);
        return (
          <div
            key={o.id}
            className={cn(
              "rounded-3xl bg-surface p-4 ring-1 ring-line transition",
              a.response === "yes" && "ring-2 ring-emerald-500/60",
              a.response === "maybe" && "ring-2 ring-amber-400/60",
              a.response === "no" && "opacity-80"
            )}
          >
            <div className="flex items-center gap-3">
              <CalendarTile iso={o.startsAt} allDay={o.allDay} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="font-display text-lg font-semibold">{o.label || time}</p>
                  {o.id === topOptionId && <Chip tone="amber">🏆 Top pick</Chip>}
                </div>
                {o.label && <p className="text-sm text-muted">{time}</p>}
                <div className="mt-1 flex items-center gap-2">
                  <AvatarStack people={o.yesPeople} />
                  <span className="text-xs font-bold whitespace-nowrap text-muted">
                    {o.yes} yes · {o.maybe} maybe
                    {o.totalAttendees > 0 && ` · 👥 ${o.totalAttendees}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={a.response === c.value}
                  onClick={() => update(o.id, { response: c.value })}
                  className={cn(
                    "rounded-2xl py-2.5 text-sm font-extrabold transition active:scale-95",
                    a.response === c.value ? c.selected : "bg-surface-2 text-muted hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {showHeadcount && (
              <div className="mt-3 flex flex-wrap gap-2">
                {spousesInvited && (
                  <Stepper label="+ adults" value={a.adults} onChange={(adults) => update(o.id, { adults })} />
                )}
                {kidsAllowed && (
                  <Stepper label="+ kids" value={a.kids} onChange={(kids) => update(o.id, { kids })} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {error && <ErrorText>{error}</ErrorText>}
      {/* Sticky so the save button stays reachable above the phone tab bar;
          the fade keeps cards scrolling underneath from clashing with it. */}
      <div className="sticky bottom-24 z-10 -mx-4 bg-linear-to-t from-background via-background/90 to-transparent px-4 pt-6 pb-2 md:bottom-0 md:pb-4">
        <Button type="submit" size="lg" full disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : status === "saved" ? "✅ Vote saved!" : "Save my vote"}
        </Button>
      </div>
    </form>
  );
}
