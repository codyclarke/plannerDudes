// Answer buttons + headcount steppers shared by the date vote (VoteForm) and
// the post-lock-in RSVP (RsvpForm). No hooks — state lives in the parent.
import { Stepper, cn } from "@/components/ui";

export type Response = "yes" | "maybe" | "no";
export type Answer = { response: Response | null; adults: number; kids: number };

const CHOICE_STYLES: Record<Response, string> = {
  yes: "bg-emerald-500 text-white shadow-md shadow-emerald-500/30",
  maybe: "bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30",
  no: "bg-rose-500 text-white shadow-md shadow-rose-500/30",
};

export function ResponseButtons({
  value,
  onChange,
  labels,
  disabled = false,
}: {
  value: Response | null;
  onChange: (response: Response) => void;
  labels: Record<Response, string>;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["yes", "maybe", "no"] as const).map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          disabled={disabled}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-2xl py-2.5 text-sm font-extrabold transition active:scale-95 disabled:pointer-events-none disabled:opacity-60",
            value === r ? CHOICE_STYLES[r] : "bg-surface-2 text-muted hover:text-foreground"
          )}
        >
          {labels[r]}
        </button>
      ))}
    </div>
  );
}

/**
 * +adults / +kids steppers, shown only while attending (yes/maybe) and only
 * for the extra people the event allows.
 */
export function HeadcountSteppers({
  answer,
  onChange,
  spousesInvited,
  kidsAllowed,
}: {
  answer: Answer;
  onChange: (patch: Partial<Answer>) => void;
  spousesInvited: boolean;
  kidsAllowed: boolean;
}) {
  const attending = answer.response === "yes" || answer.response === "maybe";
  if (!attending || !(spousesInvited || kidsAllowed)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {spousesInvited && (
        <Stepper label="+ adults" value={answer.adults} onChange={(adults) => onChange({ adults })} />
      )}
      {kidsAllowed && <Stepper label="+ kids" value={answer.kids} onChange={(kids) => onChange({ kids })} />}
    </div>
  );
}

/** Vote payload for one answer: headcount is zeroed when not attending or not allowed. */
export function toVotePayload(
  eventOptionId: string,
  answer: Answer,
  { spousesInvited, kidsAllowed }: { spousesInvited: boolean; kidsAllowed: boolean }
) {
  const attending = answer.response !== "no";
  return {
    eventOptionId,
    response: answer.response,
    adultsCount: attending && spousesInvited ? answer.adults : 0,
    kidsCount: attending && kidsAllowed ? answer.kids : 0,
  };
}
