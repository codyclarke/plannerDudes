"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, cn } from "@/components/ui";
import type { OptionView } from "./event-view";
import { type Answer, HeadcountSteppers, ResponseButtons, toVotePayload } from "./response-controls";

const LABELS = { yes: "🎉 I'm in", maybe: "🤔 Maybe", no: "😢 Can't" };

/**
 * RSVP for a locked-in date. Saves to the user's vote on that date, so
 * "Who's coming", the headcount and the reminder list stay in sync.
 */
export default function RsvpForm({
  eventId,
  option,
  spousesInvited,
  kidsAllowed,
}: {
  eventId: string;
  option: OptionView;
  spousesInvited: boolean;
  kidsAllowed: boolean;
}) {
  const router = useRouter();
  const saved: Answer = { response: option.myResponse, adults: option.myAdults, kids: option.myKids };
  const [answer, setAnswer] = useState<Answer>(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    answer.response !== saved.response || answer.adults !== saved.adults || answer.kids !== saved.kids;

  function update(patch: Partial<Answer>) {
    setStatus("idle");
    setAnswer((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    if (!answer.response) return;
    setError(null);
    setStatus("saving");
    const res = await fetch(`/api/events/${eventId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votes: [toVotePayload(option.id, answer, { spousesInvited, kidsAllowed })] }),
    });
    if (!res.ok) {
      setStatus("idle");
      setError("Couldn't save your RSVP — try again.");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <div
      className={cn(
        "rounded-3xl bg-surface p-4 ring-1 ring-line",
        // Nudge people who haven't answered yet.
        !saved.response && "ring-2 ring-violet-500/60"
      )}
    >
      <p className="mb-3 font-display text-lg font-semibold">
        {saved.response ? "Your RSVP" : "Are you coming?"}
      </p>
      <ResponseButtons value={answer.response} onChange={(response) => update({ response })} labels={LABELS} />
      <div className="mt-3 empty:hidden">
        <HeadcountSteppers
          answer={answer}
          onChange={update}
          spousesInvited={spousesInvited}
          kidsAllowed={kidsAllowed}
        />
      </div>
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {(dirty || status !== "idle") && (
        <Button
          full
          className="mt-3"
          onClick={save}
          disabled={!answer.response || !dirty || status === "saving"}
        >
          {status === "saving" ? "Saving…" : status === "saved" && !dirty ? "✅ RSVP saved!" : "Save RSVP"}
        </Button>
      )}
    </div>
  );
}
