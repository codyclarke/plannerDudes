import Link from "next/link";
import type { Person } from "@/lib/people";
import { formatWhen } from "@/lib/format";
import { AvatarStack, Chip, EmptyState, SectionTitle, buttonClasses, cn, eventTheme } from "@/components/ui";

export type DashboardEvent = {
  id: string;
  title: string;
  emoji: string;
  imageUrl: string | null;
  location: string | null;
  spousesInvited: boolean;
  kidsAllowed: boolean;
  status: "polling" | "finalized";
  when: { iso: string; allDay: boolean } | null;
  optionCount: number;
  going: Person[];
  goingExtra: number;
  votedCount: number;
  participantCount: number;
  iVoted: boolean;
};

export default function DashboardView({ name, events }: { name: string; events: DashboardEvent[] }) {
  const firstName = name.split(/\s+/)[0];
  const locked = events.filter((e) => e.status === "finalized");
  const voting = events.filter((e) => e.status === "polling");
  const needsVote = voting.filter((e) => !e.iVoted).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-6 text-white shadow-xl shadow-fuchsia-500/25">
        <span aria-hidden className="pointer-events-none absolute -top-6 -right-4 text-[7rem] opacity-20 rotate-12">
          🎉
        </span>
        <h1 className="font-display text-3xl font-semibold">Hey {firstName}! 👋</h1>
        <p className="mt-1 font-semibold text-white/85">
          {events.length === 0
            ? "Nothing on the calendar yet."
            : `You've got ${events.length} ${events.length === 1 ? "plan" : "plans"} in the works.`}
        </p>
        {(locked.length > 0 || needsVote > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {locked.length > 0 && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold backdrop-blur">
                🔒 {locked.length} locked in
              </span>
            )}
            {needsVote > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-fuchsia-600">
                🗳️ {needsVote} {needsVote === 1 ? "needs" : "need"} your vote
              </span>
            )}
          </div>
        )}
      </section>

      {events.length === 0 && (
        <EmptyState emoji="🦗" title="It's quiet in here">
          <p>Get the crew together — propose a few dates and let everyone vote.</p>
          <Link href="/events/new" className={cn(buttonClasses("primary", { size: "lg" }), "mt-4")}>
            Plan something ✨
          </Link>
        </EmptyState>
      )}

      {locked.length > 0 && (
        <section>
          <SectionTitle>🔒 Locked in</SectionTitle>
          <div className="flex flex-col gap-3">
            {locked.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {voting.length > 0 && (
        <section>
          <SectionTitle>🗳️ Still voting</SectionTitle>
          <div className="flex flex-col gap-3">
            {voting.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EventCard({ event: e }: { event: DashboardEvent }) {
  const theme = eventTheme(e.id);
  return (
    <Link
      href={`/events/${e.id}`}
      className={cn(
        "group block overflow-hidden rounded-3xl ring-1 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]",
        theme.card
      )}
    >
      {e.imageUrl && (
        <div className="h-32 w-full sm:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image optimization adds nothing */}
          <img src={e.imageUrl} alt="" className="size-full object-cover" />
        </div>
      )}
      <div className="flex gap-4 p-4">
        <span
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-2xl text-3xl",
            theme.emoji,
            // With a cover photo, the emoji bubble overlaps its bottom edge.
            e.imageUrl && "relative z-10 -mt-10 bg-surface shadow-md ring-4 ring-surface"
          )}
        >
          {e.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-lg leading-snug font-semibold">{e.title}</h3>
            <span className="text-muted transition group-hover:translate-x-0.5">→</span>
          </div>
  
          {e.status === "finalized" && e.when ? (
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
              {formatWhen(e.when.iso, e.when.allDay)}
            </p>
          ) : (
            <p className="text-sm font-semibold text-muted">
              {e.optionCount} {e.optionCount === 1 ? "date" : "dates"} · {e.votedCount} of {e.participantCount} voted
            </p>
          )}
          {e.location && <p className="truncate text-sm text-muted">📍 {e.location}</p>}
  
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {e.status === "finalized" ? (
              e.going.length > 0 ? (
                <span className="flex items-center gap-2">
                  <AvatarStack people={e.going} />
                  <span className="text-xs font-bold text-muted">
                    {e.going.length} going{e.goingExtra > 0 ? ` (+${e.goingExtra})` : ""}
                  </span>
                </span>
              ) : (
                <span className="text-xs font-bold text-muted">No one confirmed yet</span>
              )
            ) : e.iVoted ? (
              <Chip tone="emerald">✅ You voted</Chip>
            ) : (
              <span className="rounded-full bg-linear-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-extrabold text-white shadow-sm">
                🗳️ Vote now
              </span>
            )}
            {e.spousesInvited && <Chip tone="violet">💑 Partners</Chip>}
            {e.kidsAllowed && <Chip tone="sky">🧒 Kids</Chip>}
          </div>
        </div>
      </div>
    </Link>
  );
}
