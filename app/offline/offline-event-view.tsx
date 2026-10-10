import { dateParts, formatWhen } from "@/lib/format";
import type { OfflineEvent } from "@/lib/offline-snapshot";
import { describeDeadline } from "@/lib/voting-deadline";
import { Avatar, AvatarStack, CalendarTile, Card, Chip, SectionTitle, cn, eventTheme } from "@/components/ui";

const ANSWER: Record<"yes" | "maybe" | "no", string> = { yes: "✅ Yes", maybe: "🤔 Maybe", no: "😢 Can't" };
const PLACE_ANSWER: Record<"yes" | "maybe" | "no", string> = { yes: "✅ Yes", maybe: "🤔 Maybe", no: "👎 No" };
const RSVP: Record<"yes" | "maybe" | "no", string> = { yes: "🎉 You're in", maybe: "🤔 You're a maybe", no: "😢 You can't make it" };

const asPeople = (names: string[]) => names.map((name) => ({ name, avatarUrl: null }));

/** Reads the clock, so it lives outside the component. */
const deadlineNow = (closesAt: string | null) => describeDeadline(closesAt, new Date());

/** Read-only version of the event page, built from the offline snapshot. */
export default function OfflineEventView({ event }: { event: OfflineEvent }) {
  const theme = eventTheme(event.id);
  const finalized = event.options.find((o) => o.id === event.finalizedOptionId);
  const chosenPlace = event.places.find((p) => p.id === event.chosenPlaceId);
  const deadline = event.status === "polling" ? deadlineNow(event.votingClosesAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <a href="#list" className="self-start text-sm font-bold text-muted hover:text-foreground">
        ← All events
      </a>

      <section className={cn("rounded-[2rem] p-5 ring-1", theme.card)}>
        <div className="flex items-start gap-4">
          <span className={cn("grid size-16 shrink-0 place-items-center rounded-3xl text-4xl", theme.emoji)}>
            {event.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight font-semibold">{event.title}</h1>
            <p className="text-sm font-semibold text-muted">Organized by {event.organizerName}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {event.status === "finalized" ? (
            <Chip tone="emerald">{event.fixedDate ? "📅 Set date" : "🔒 Locked in"}</Chip>
          ) : (
            <Chip tone="amber">🗳️ Voting open</Chip>
          )}
          <Chip tone={event.spousesInvited ? "violet" : "neutral"}>
            {event.spousesInvited ? "💑 Partners invited" : "Friends only"}
          </Chip>
          <Chip tone={event.kidsAllowed ? "sky" : "neutral"}>{event.kidsAllowed ? "🧒 Kids welcome" : "No kids"}</Chip>
        </div>
        {event.location && <p className="mt-4 font-semibold">📍 {event.location}</p>}
        {event.description && <p className="mt-2 whitespace-pre-wrap text-muted">{event.description}</p>}
      </section>

      {finalized ? (
        <Card className="flex flex-col gap-4">
          <p className="font-display text-2xl font-semibold">🎉 It&apos;s happening!</p>
          <div className="flex items-center gap-4">
            <CalendarTile iso={finalized.startsAt} allDay={finalized.allDay} className="w-16" />
            <div>
              <p className="font-display text-xl font-semibold">{formatWhen(finalized.startsAt, finalized.allDay)}</p>
              {finalized.label && <p className="text-sm text-muted">{finalized.label}</p>}
            </div>
          </div>
          {chosenPlace && (
            <p className="font-semibold">📍 Staying at {chosenPlace.title ?? chosenPlace.siteName ?? "the picked place"}</p>
          )}
          <p className="rounded-2xl bg-surface-2 px-4 py-3 font-bold">
            {finalized.myResponse ? RSVP[finalized.myResponse] : "📝 You haven't RSVP'd yet"}
          </p>
          <WhoIsComing event={event} />
        </Card>
      ) : (
        <section>
          <SectionTitle>Dates being voted on</SectionTitle>
          {deadline && (
            <p
              className={cn(
                "mb-3 rounded-2xl px-4 py-2 text-sm font-bold",
                deadline.urgent ? "bg-rose-500/12 text-rose-700 dark:text-rose-300" : "bg-surface-2"
              )}
            >
              ⏳ {deadline.long}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {event.options.map((o) => (
              <Card key={o.id} className="flex items-center gap-3 p-4">
                <CalendarTile iso={o.startsAt} allDay={o.allDay} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">
                    {o.label || (dateParts(o.startsAt, o.allDay).time ?? "All day")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <AvatarStack people={asPeople(o.yesNames)} />
                    <span className="text-xs font-bold text-muted">
                      {o.yes} yes · {o.maybe} maybe · {o.no} no
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold whitespace-nowrap text-muted">
                  {o.myResponse ? `You: ${ANSWER[o.myResponse]}` : "You: —"}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {event.places.length > 0 && (
        <section>
          <SectionTitle>🏠 Where should we stay?</SectionTitle>
          <div className="flex flex-col gap-2">
            {event.places.map((p) => (
              <Card key={p.id} className={cn("p-4", p.id === event.chosenPlaceId && "ring-2 ring-emerald-500/70")}>
                <div className="flex flex-wrap items-center gap-2">
                  {p.siteName && (
                    <span className="text-[11px] font-extrabold tracking-wide text-muted uppercase">{p.siteName}</span>
                  )}
                  {p.id === event.chosenPlaceId && <Chip tone="emerald">📍 We&apos;re staying here</Chip>}
                </div>
                <p className="font-semibold">{p.title ?? p.siteName ?? "Link"}</p>
                <p className="mt-1 text-xs font-bold text-muted">
                  {p.yes} yes · {p.maybe} maybe · {p.no} no
                  {p.myResponse ? ` · You: ${PLACE_ANSWER[p.myResponse]}` : ""}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WhoIsComing({ event }: { event: OfflineEvent }) {
  const headcount = event.going.reduce((n, g) => n + 1 + g.adults + g.kids, 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Who&apos;s coming</h2>
        {headcount > 0 && <Chip tone="violet">👥 {headcount} total</Chip>}
      </div>
      {event.going.length === 0 ? (
        <p className="text-muted">No one has said they&apos;re in yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {event.going.map((g, i) => (
            <li key={`${g.name}-${i}`} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
              <Avatar name={g.name} />
              <span className="font-bold">{g.name}</span>
              <span className="ml-auto text-sm font-semibold text-muted">
                {[
                  g.adults > 0 && `+${g.adults} ${g.adults === 1 ? "adult" : "adults"}`,
                  g.kids > 0 && `+${g.kids} ${g.kids === 1 ? "kid" : "kids"}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {event.maybeNames.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <AvatarStack people={asPeople(event.maybeNames)} />
          <span className="text-sm font-semibold text-muted">
            🤔 {event.maybeNames.join(", ")} {event.maybeNames.length === 1 ? "is" : "are"} a maybe
          </span>
        </div>
      )}
    </div>
  );
}
