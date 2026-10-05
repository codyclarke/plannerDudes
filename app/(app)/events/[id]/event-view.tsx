import Link from "next/link";
import type { Person } from "@/lib/people";
import { formatWhen } from "@/lib/format";
import { Avatar, Card, CalendarTile, Chip, SectionTitle, buttonClasses, cn, eventTheme } from "@/components/ui";
import VoteForm from "./vote-form";
import FinalizeControl from "./finalize-control";
import CoverEditor from "./cover-editor";

export type OptionView = {
  id: string;
  startsAt: string;
  allDay: boolean;
  label: string | null;
  yes: number;
  maybe: number;
  no: number;
  totalAttendees: number;
  yesPeople: Person[];
  myResponse: "yes" | "maybe" | "no" | null;
  myAdults: number;
  myKids: number;
};

export type EventViewProps = {
  event: {
    id: string;
    title: string;
    emoji: string;
    description: string | null;
    location: string | null;
    spousesInvited: boolean;
    kidsAllowed: boolean;
    status: "polling" | "finalized" | "cancelled";
    organizerName: string;
    imageUrl: string | null;
  };
  isOrganizer: boolean;
  options: OptionView[];
  finalizedOptionId: string | null;
  topOptionId: string | null;
  going: (Person & { adults: number; kids: number })[];
};

export default function EventView({
  event,
  isOrganizer,
  options,
  finalizedOptionId,
  topOptionId,
  going,
}: EventViewProps) {
  const theme = eventTheme(event.id);
  const finalized = options.find((o) => o.id === finalizedOptionId);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard" className="self-start text-sm font-bold text-muted hover:text-foreground">
        ← All events
      </Link>

      <section className={cn("overflow-hidden rounded-[2rem] ring-1", theme.card)}>
        {/* Header photo: organizers can add/change/remove it in place. */}
        {isOrganizer && event.imageUrl ? (
          <CoverEditor eventId={event.id} imageUrl={event.imageUrl} />
        ) : event.imageUrl ? (
          <div className="aspect-[16/7] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image optimization adds nothing */}
            <img src={event.imageUrl} alt="" className="size-full object-cover" />
          </div>
        ) : null}

        <div className="p-5">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "grid size-16 shrink-0 place-items-center rounded-3xl text-4xl",
                theme.emoji,
                // With a photo, the emoji bubble overlaps its bottom edge.
                event.imageUrl && "relative z-10 -mt-12 bg-surface shadow-lg ring-4 ring-surface"
              )}
            >
              {event.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight font-semibold">{event.title}</h1>
              <p className="text-sm font-semibold text-muted">Organized by {event.organizerName}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {event.status === "finalized" ? (
              <Chip tone="emerald">🔒 Locked in</Chip>
            ) : (
              <Chip tone="amber">🗳️ Voting open</Chip>
            )}
            <Chip tone={event.spousesInvited ? "violet" : "neutral"}>
              {event.spousesInvited ? "💑 Spouses invited" : "Friends only"}
            </Chip>
            <Chip tone={event.kidsAllowed ? "sky" : "neutral"}>
              {event.kidsAllowed ? "🧒 Kids welcome" : "No kids"}
            </Chip>
          </div>
          {event.location && <p className="mt-4 font-semibold">📍 {event.location}</p>}
          {event.description && <p className="mt-2 whitespace-pre-wrap text-muted">{event.description}</p>}
          {isOrganizer && !event.imageUrl && (
            <div className="mt-4">
              <CoverEditor eventId={event.id} imageUrl={null} />
            </div>
          )}
        </div>
      </section>

      {event.status === "finalized" && finalized ? (
        <LockedIn eventId={event.id} option={finalized} going={going} />
      ) : (
        <>
          <section>
            <SectionTitle>When works for you?</SectionTitle>
            <VoteForm
              eventId={event.id}
              options={options}
              topOptionId={topOptionId}
              spousesInvited={event.spousesInvited}
              kidsAllowed={event.kidsAllowed}
            />
          </section>
          {isOrganizer && options.length > 0 && (
            <FinalizeControl eventId={event.id} options={options} topOptionId={topOptionId} />
          )}
        </>
      )}
    </div>
  );
}

function LockedIn({
  eventId,
  option,
  going,
}: {
  eventId: string;
  option: OptionView;
  going: EventViewProps["going"];
}) {
  const headcount = going.reduce((n, g) => n + 1 + g.adults + g.kids, 0);
  return (
    <div className="rounded-[2rem] bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-[3px] shadow-xl shadow-fuchsia-500/20">
      <div className="rounded-[calc(2rem-3px)] bg-surface p-5">
        <p className="font-display text-2xl font-semibold">🎉 It&apos;s happening!</p>
        <div className="mt-4 flex items-center gap-4">
          <CalendarTile iso={option.startsAt} allDay={option.allDay} className="w-16" />
          <div>
            <p className="font-display text-xl font-semibold">{formatWhen(option.startsAt, option.allDay)}</p>
            {option.label && <p className="text-sm text-muted">{option.label}</p>}
          </div>
        </div>
        {/* Plain <a>: next/link would prefetch/route-transition a file download. */}
        <a
          href={`/api/events/${eventId}/ics`}
          download
          className={cn(buttonClasses("primary", { size: "lg", full: true }), "mt-5")}
        >
          📅 Add to my calendar
        </a>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Who&apos;s coming</h2>
            {headcount > 0 && <Chip tone="violet">👥 {headcount} total</Chip>}
          </div>
          {going.length === 0 ? (
            <p className="text-muted">No one has confirmed this date yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {going.map((g) => (
                <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2.5">
                  <Avatar name={g.name} src={g.avatarUrl} />
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
        </div>
      </div>
    </div>
  );
}

export function EventNotFound() {
  return (
    <Card className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-5xl">🕵️</span>
      <p className="font-display text-xl font-semibold">Event not found</p>
      <p className="text-muted">It may have been removed, or you&apos;re not invited to it.</p>
      <Link href="/dashboard" className={cn(buttonClasses("secondary"), "mt-3")}>
        Back to events
      </Link>
    </Card>
  );
}
