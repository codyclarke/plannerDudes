import type { ReactNode } from "react";
import type { Person } from "@/lib/people";
import { Avatar, cn } from "@/components/ui";

// Who answered what — only built for (and shown to) the event's organizer
// and the app owner. Collapsed by default to keep the page clean.

export type RosterPerson = Person & { adults?: number; kids?: number };

/** Everyone in the group, split by their answer to one date. */
export type DateRoster = {
  yes: RosterPerson[];
  maybe: RosterPerson[];
  no: Person[];
  none: Person[];
};

/** Voting: who has voted on any date yet. Locked in: answers to the final date. */
export type EventRoster =
  | { mode: "voting"; voted: Person[]; notVoted: Person[] }
  | ({ mode: "rsvp" } & DateRoster);

const extras = (p: RosterPerson) =>
  [
    p.adults ? `+${p.adults} ${p.adults === 1 ? "adult" : "adults"}` : null,
    p.kids ? `+${p.kids} ${p.kids === 1 ? "kid" : "kids"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

function Group({ label, people, empty }: { label: string; people: RosterPerson[]; empty: string }) {
  return (
    <div>
      <p className="text-xs font-extrabold tracking-wide text-muted uppercase">
        {label} · {people.length}
      </p>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-3 pl-0.5 text-sm font-bold">
              <Avatar name={p.name} src={p.avatarUrl} size="sm" />
              {p.name}
              {extras(p) && <span className="font-semibold text-muted">{extras(p)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Collapsible({ summary, className, children }: { summary: ReactNode; className?: string; children: ReactNode }) {
  return (
    <details className={cn("group", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-muted select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition group-open:rotate-90">▸</span>
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

const VISIBILITY_NOTE = <p className="text-xs font-semibold text-muted">👀 Only the organizer and app owner see this.</p>;

function DateGroups({ roster, yesLabel = "🎉 Yes" }: { roster: DateRoster; yesLabel?: string }) {
  return (
    <>
      <Group label={yesLabel} people={roster.yes} empty="Nobody yet." />
      <Group label="🤔 Maybe" people={roster.maybe} empty="Nobody." />
      <Group label="😢 Can't" people={roster.no} empty="Nobody." />
      <Group label="⏳ No answer yet" people={roster.none} empty="Everyone has answered! 🙌" />
    </>
  );
}

/** Per-date breakdown under a poll option. */
export function DateRosterDetails({ roster }: { roster: DateRoster }) {
  return (
    <Collapsible
      className="mt-3 border-t border-line pt-3"
      summary={`Who said what${roster.none.length ? ` · ${roster.none.length} haven't answered` : ""}`}
    >
      <DateGroups roster={roster} />
    </Collapsible>
  );
}

/** The whole group's responses to the event, for the organizer / owner. */
export function EventRosterCard({ roster }: { roster: EventRoster }) {
  const summary =
    roster.mode === "voting"
      ? `👥 Responses · ${roster.voted.length} voted · ${roster.notVoted.length} haven't`
      : `👥 Responses · ${roster.yes.length} going · ${roster.maybe.length} maybe · ${roster.no.length} can't · ${roster.none.length} no response`;
  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
      <Collapsible summary={summary}>
        {VISIBILITY_NOTE}
        {roster.mode === "voting" ? (
          <>
            <Group label="✅ Voted" people={roster.voted} empty="Nobody yet." />
            <Group label="⏳ Hasn't voted" people={roster.notVoted} empty="Everyone has voted! 🙌" />
          </>
        ) : (
          <DateGroups roster={roster} yesLabel="🎉 Going" />
        )}
      </Collapsible>
    </div>
  );
}
