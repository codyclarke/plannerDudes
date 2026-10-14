import Link from "next/link";
import type { Person } from "@/lib/people";
import { formatWhen } from "@/lib/format";
import { Avatar, AvatarStack, Card, CalendarTile, Chip, SectionTitle, buttonClasses, cn, eventTheme } from "@/components/ui";
import VoteForm from "./vote-form";
import FinalizeControl from "./finalize-control";
import CoverEditor from "./cover-editor";
import RsvpForm from "./rsvp-form";
import DeadlineBanner from "./deadline-banner";
import ChangeDate from "./change-date";
import PlacesSection, { type PlaceView } from "./places-section";
import EditEvent, { type EditableEvent } from "./edit-event";
import type { Deadline } from "@/lib/voting-deadline";
import type { ReactionView } from "@/lib/reactions";
import ReactionBar from "./reaction-bar";
import { EventRosterCard, type DateRoster, type EventRoster } from "./roster";
import Chatter, { ChatterJumpChip } from "./chatter";
import type { ChatterPage } from "@/lib/chatter";

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
  maybePeople: Person[];
  myResponse: "yes" | "maybe" | "no" | null;
  myAdults: number;
  myKids: number;
  /** Who answered what — only for the organizer / app owner. */
  roster?: DateRoster;
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
    /** Date was set up front (no vote): created locked in. */
    fixedDate: boolean;
    imageUrl: string | null;
  };
  isOrganizer: boolean;
  options: OptionView[];
  finalizedOptionId: string | null;
  topOptionId: string | null;
  going: (Person & { adults: number; kids: number; reactions: ReactionView[] })[];
  /** Viewer's display name (for their own reactions before the save lands). */
  myName: string;
  /** Voting countdown, or null when the event has no deadline. */
  deadline: Deadline | null;
  /** Closing day "YYYY-MM-DD" in the group's timezone, for the organizer's editor. */
  closesOnDate: string | null;
  /** "Where should we stay?" links (empty = section hidden behind a button). */
  places: PlaceView[];
  chosenPlaceId: string | null;
  topPlaceId: string | null;
  /** Set when the viewer is the organizer or app owner: enables Edit / Delete. */
  editable: EditableEvent | null;
  /** Everyone's responses — only for the organizer / app owner. */
  roster: EventRoster | null;
  chatter: {
    initial: ChatterPage;
    lastReadAt: string | null;
    unread: number;
    me: { id: string; name: string };
    /** Organizer or app owner: delete any message, pin ideas. */
    canModerate: boolean;
    people: Person[];
  };
};

export default function EventView({
  event,
  isOrganizer,
  options,
  finalizedOptionId,
  topOptionId,
  going,
  myName,
  deadline,
  closesOnDate,
  places,
  chosenPlaceId,
  topPlaceId,
  editable,
  roster,
  chatter,
}: EventViewProps) {
  const chosenPlace = places.find((p) => p.id === chosenPlaceId) ?? null;
  const theme = eventTheme(event.id);
  const finalized = options.find((o) => o.id === finalizedOptionId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard" className="text-sm font-bold text-muted hover:text-foreground">
          ← All events
        </Link>
        {editable && <EditEvent event={editable} />}
      </div>

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
              <Chip tone="emerald">{event.fixedDate ? "📅 Set date" : "🔒 Locked in"}</Chip>
            ) : (
              <Chip tone="amber">🗳️ Voting open</Chip>
            )}
            <Chip tone={event.spousesInvited ? "violet" : "neutral"}>
              {event.spousesInvited ? "💑 Partners invited" : "Friends only"}
            </Chip>
            <Chip tone={event.kidsAllowed ? "sky" : "neutral"}>
              {event.kidsAllowed ? "🧒 Kids welcome" : "No kids"}
            </Chip>
          </div>
          {event.location && <p className="mt-4 font-semibold">📍 {event.location}</p>}
          {event.description && <p className="mt-2 whitespace-pre-wrap text-muted">{event.description}</p>}
          <div className="mt-4">
            <ChatterJumpChip
              eventId={event.id}
              initialTotal={chatter.initial.total}
              initialUnread={chatter.unread}
            />
          </div>
          {isOrganizer && !event.imageUrl && (
            <div className="mt-4">
              <CoverEditor eventId={event.id} imageUrl={null} />
            </div>
          )}
        </div>
      </section>

      {event.status === "finalized" && finalized ? (
        <>
        <LockedIn
          eventId={event.id}
          option={finalized}
          going={going}
          myName={myName}
          spousesInvited={event.spousesInvited}
          kidsAllowed={event.kidsAllowed}
          canChangeDate={isOrganizer && event.fixedDate}
          chosenPlace={chosenPlace}
        />
        {roster && <EventRosterCard roster={roster} />}
        </>
      ) : (
        <>
          <section>
            <SectionTitle>When works for you?</SectionTitle>
            <div className="mb-3">
              <DeadlineBanner
                eventId={event.id}
                deadline={deadline}
                closesOnDate={closesOnDate}
                isOrganizer={isOrganizer}
              />
            </div>
            {roster && (
              <div className="mb-3">
                <EventRosterCard roster={roster} />
              </div>
            )}
            <VoteForm
              eventId={event.id}
              options={options}
              topOptionId={topOptionId}
              spousesInvited={event.spousesInvited}
              kidsAllowed={event.kidsAllowed}
              closed={!!deadline?.closed}
            />
          </section>
          {isOrganizer && options.length > 0 && (
            <FinalizeControl eventId={event.id} options={options} topOptionId={topOptionId} />
          )}
        </>
      )}

      <PlacesSection
        eventId={event.id}
        places={places}
        chosenPlaceId={chosenPlaceId}
        topPlaceId={topPlaceId}
        isOrganizer={isOrganizer}
      />

      <Chatter
        eventId={event.id}
        initial={chatter.initial}
        lastReadAt={chatter.lastReadAt}
        me={chatter.me}
        canModerate={chatter.canModerate}
        people={chatter.people}
      />
    </div>
  );
}

function LockedIn({
  eventId,
  option,
  going,
  myName,
  spousesInvited,
  kidsAllowed,
  canChangeDate,
  chosenPlace,
}: {
  eventId: string;
  option: OptionView;
  going: EventViewProps["going"];
  myName: string;
  spousesInvited: boolean;
  kidsAllowed: boolean;
  /** Organizer of a set-date event can move it. */
  canChangeDate: boolean;
  chosenPlace: PlaceView | null;
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
        {chosenPlace && (
          <a
            href={chosenPlace.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block font-semibold hover:underline"
          >
            📍 Staying at {chosenPlace.title ?? chosenPlace.siteName ?? "the picked place"}{" "}
            <span className="text-muted">↗</span>
          </a>
        )}
        {canChangeDate && (
          <div className="mt-3">
            <ChangeDate eventId={eventId} startsAt={option.startsAt} allDay={option.allDay} />
          </div>
        )}
        {/* Plain <a>: next/link would prefetch/route-transition a file download. */}
        <a
          href={`/api/events/${eventId}/ics`}
          download
          className={cn(buttonClasses("primary", { size: "lg", full: true }), "mt-5")}
        >
          📅 Add to my calendar
        </a>

        {/* RSVPs stay open after lock-in, for this date only. */}
        <div className="mt-5">
          <RsvpForm eventId={eventId} option={option} spousesInvited={spousesInvited} kidsAllowed={kidsAllowed} />
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Who&apos;s coming</h2>
            {headcount > 0 && <Chip tone="violet">👥 {headcount} total</Chip>}
          </div>
          {going.length === 0 ? (
            <p className="text-muted">No one has said they&apos;re in yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {going.map((g) => (
                <li key={g.id} className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-2.5">
                  <div className="flex items-center gap-3">
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
                  </div>
                  <ReactionBar
                    endpoint={`/api/events/${eventId}/reactions`}
                    extraBody={{ targetId: g.id }}
                    label={`React to ${g.name}'s RSVP`}
                    myName={myName}
                    reactions={g.reactions}
                    indent
                  />
                </li>
              ))}
            </ul>
          )}
          {option.maybePeople.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <AvatarStack people={option.maybePeople} />
              <span className="text-sm font-semibold text-muted">
                🤔 {option.maybePeople.map((p) => p.name).join(", ")} {option.maybePeople.length === 1 ? "is" : "are"} a maybe
              </span>
            </div>
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
      <p className="text-muted">It may have been removed, or the link is wrong.</p>
      <Link href="/dashboard" className={cn(buttonClasses("secondary"), "mt-3")}>
        Back to events
      </Link>
    </Card>
  );
}
