import { createClient } from "@/lib/supabase/server";
import { eventEmoji } from "@/lib/emoji";
import { signImages } from "@/lib/images.server";
import { EVENT_IMAGES_BUCKET } from "@/lib/images";
import { loadPeople } from "@/lib/people.server";
import { dateKeyInAppZone } from "@/lib/format";
import { describeDeadline } from "@/lib/voting-deadline";
import { groupReactions } from "@/lib/reactions";
import { loadChatter, loadLastRead } from "@/lib/chatter.server";
import EventView, { EventNotFound, type OptionView } from "./event-view";
import type { PlaceView } from "./places-section";
import type { EditableEvent } from "./edit-event";
import type { DateRoster, EventRoster } from "./roster";

// Reads the clock, so it lives outside the component (render must stay pure).
function deadlineProps(closesAt: string | null) {
  return {
    deadline: describeDeadline(closesAt, new Date()),
    closesOnDate: closesAt ? dateKeyInAppZone(new Date(closesAt)) : null,
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) return <EventNotFound />;

  const [{ data: options }, people] = await Promise.all([
    supabase.from("event_options").select("*").eq("event_id", eventId).order("sort_order"),
    loadPeople(supabase),
  ]);
  const optionList = options ?? [];
  const optionIds = optionList.map((o) => o.id);

  // RLS lets every participant read all votes on the event, so tallies and
  // "who said yes" are computed from the votes directly.
  const { data: votes } = optionIds.length
    ? await supabase.from("votes").select("*").in("event_option_id", optionIds)
    : { data: [] };
  const allVotes = votes ?? [];

  // Organizer or app owner: edit details, fix poll dates, delete, and see
  // who answered what.
  const isOrganizer = event.organizer_id === auth.user.id;
  const canManage = isOrganizer || !!people.list.find((p) => p.id === auth.user!.id)?.isOwner;
  const toPerson = ({ id, name, avatarUrl }: { id: string; name: string; avatarUrl: string | null }) => ({
    id,
    name,
    avatarUrl,
  });
  /** Everyone in the group, by their answer to one date. */
  const dateRoster = (optionId: string): DateRoster => {
    const optionVotes = allVotes.filter((v) => v.event_option_id === optionId);
    const answered = new Set(optionVotes.map((v) => v.profile_id));
    const withExtras = (response: "yes" | "maybe") =>
      optionVotes
        .filter((v) => v.response === response)
        .map((v) => ({ ...toPerson(people.get(v.profile_id)), adults: v.adults_count, kids: v.kids_count }));
    return {
      yes: withExtras("yes"),
      maybe: withExtras("maybe"),
      no: optionVotes.filter((v) => v.response === "no").map((v) => toPerson(people.get(v.profile_id))),
      none: people.list.filter((p) => !answered.has(p.id)).map(toPerson),
    };
  };

  const optionViews: OptionView[] = optionList.map((o) => {
    const optionVotes = allVotes.filter((v) => v.event_option_id === o.id);
    const yesVotes = optionVotes.filter((v) => v.response === "yes");
    const maybeVotes = optionVotes.filter((v) => v.response === "maybe");
    const mine = optionVotes.find((v) => v.profile_id === auth.user!.id);
    return {
      id: o.id,
      startsAt: o.starts_at,
      allDay: o.all_day,
      label: o.label,
      yes: yesVotes.length,
      maybe: maybeVotes.length,
      no: optionVotes.length - yesVotes.length - maybeVotes.length,
      totalAttendees: yesVotes.reduce((n, v) => n + 1 + v.adults_count + v.kids_count, 0),
      yesPeople: yesVotes.map((v) => people.get(v.profile_id)),
      maybePeople: maybeVotes.map((v) => people.get(v.profile_id)),
      myResponse: mine?.response ?? null,
      myAdults: mine?.adults_count ?? 0,
      myKids: mine?.kids_count ?? 0,
      ...(canManage && { roster: dateRoster(o.id) }),
    };
  });

  let roster: EventRoster | null = null;
  if (canManage && event.status === "finalized" && event.finalized_option_id) {
    roster = { mode: "rsvp", ...dateRoster(event.finalized_option_id) };
  } else if (canManage) {
    const voters = new Set(allVotes.map((v) => v.profile_id));
    roster = {
      mode: "voting",
      voted: people.list.filter((p) => voters.has(p.id)).map(toPerson),
      notVoted: people.list.filter((p) => !voters.has(p.id)).map(toPerson),
    };
  }

  // "Top pick": most people attending, then most yeses, then most maybes.
  const ranked = [...optionViews].sort(
    (a, b) => b.totalAttendees - a.totalAttendees || b.yes - a.yes || b.maybe - a.maybe
  );
  const topOptionId = ranked[0] && ranked[0].yes + ranked[0].maybe > 0 ? ranked[0].id : null;

  // The event row came through RLS above, so the viewer may see its cover.
  const imageUrls = await signImages(EVENT_IMAGES_BUCKET, [event.image_path]);

  // Emoji reactions on "I'm in" RSVPs (only shown on people who are going).
  const { data: reactionRows } = event.finalized_option_id
    ? await supabase.from("rsvp_reactions").select("*").eq("event_id", eventId)
    : { data: [] };
  const reactions = groupReactions(reactionRows ?? [], auth.user.id, (id) => people.get(id).name);

  const going = allVotes
    .filter((v) => v.event_option_id === event.finalized_option_id && v.response === "yes")
    .map((v) => ({
      ...people.get(v.profile_id),
      adults: v.adults_count,
      kids: v.kids_count,
      reactions: reactions.get(v.profile_id) ?? [],
    }));

  // "Where should we stay?" links and their votes.
  const { data: places } = await supabase
    .from("event_places")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at");
  const placeIds = (places ?? []).map((p) => p.id);
  const { data: placeVotes } = placeIds.length
    ? await supabase.from("place_votes").select("*").in("place_id", placeIds)
    : { data: [] };
  const placeViews: PlaceView[] = (places ?? []).map((p) => {
    const votes = (placeVotes ?? []).filter((v) => v.place_id === p.id);
    const yes = votes.filter((v) => v.response === "yes");
    return {
      id: p.id,
      url: p.url,
      title: p.title,
      description: p.description,
      imageUrl: p.image_url,
      siteName: p.site_name,
      addedBy: people.get(p.added_by).name,
      canEdit: isOrganizer || p.added_by === auth.user!.id,
      yes: yes.length,
      maybe: votes.filter((v) => v.response === "maybe").length,
      no: votes.filter((v) => v.response === "no").length,
      yesPeople: yes.map((v) => people.get(v.profile_id)),
      myResponse: votes.find((v) => v.profile_id === auth.user!.id)?.response ?? null,
    };
  });
  // Top pick: most yeses, then most maybes (only once someone has voted).
  const bestPlace = [...placeViews].sort((a, b) => b.yes - a.yes || b.maybe - a.maybe)[0];
  const topPlaceId = bestPlace && bestPlace.yes + bestPlace.maybe > 0 ? bestPlace.id : null;

  // Who'd be told if it's deleted: anyone (besides the organizer and you)
  // who voted, RSVP'd or voted on a place — same rule as DELETE /api/events/[id].
  const [chatterPage, lastRead, { data: chatAuthors }] = await Promise.all([
    loadChatter(supabase, eventId, auth.user.id, people.get),
    loadLastRead(supabase, [eventId], auth.user.id),
    supabase.from("event_messages").select("author_id").eq("event_id", eventId),
  ]);
  const lastReadAt = lastRead.get(eventId) ?? null;
  const responders = new Set([
    ...[...allVotes, ...(placeVotes ?? [])].map((v) => v.profile_id),
    ...(chatAuthors ?? []).map((m) => m.author_id),
  ]);
  responders.delete(event.organizer_id);
  responders.delete(auth.user.id);
  const editable: EditableEvent | null = canManage
    ? {
        id: event.id,
        title: event.title,
        emoji: eventEmoji(event.title, event.emoji),
        description: event.description,
        location: event.location,
        spousesInvited: event.spouses_invited,
        kidsAllowed: event.kids_allowed,
        polling: event.status === "polling",
        options: optionViews.map((o) => ({
          id: o.id,
          startsAt: o.startsAt,
          allDay: o.allDay,
          votes: o.yes + o.maybe + o.no,
        })),
        responderCount: responders.size,
      }
    : null;

  return (
    <EventView
      event={{
        id: event.id,
        title: event.title,
        emoji: eventEmoji(event.title, event.emoji),
        description: event.description,
        location: event.location,
        spousesInvited: event.spouses_invited,
        kidsAllowed: event.kids_allowed,
        status: event.status,
        organizerName: people.get(event.organizer_id).name,
        fixedDate: event.fixed_date,
        imageUrl: event.image_path ? (imageUrls.get(event.image_path) ?? null) : null,
      }}
      isOrganizer={isOrganizer}
      options={optionViews}
      finalizedOptionId={event.finalized_option_id}
      topOptionId={topOptionId}
      going={going}
      myName={people.get(auth.user.id).name}
      {...deadlineProps(event.voting_closes_at)}
      places={placeViews}
      chosenPlaceId={event.chosen_place_id}
      topPlaceId={topPlaceId}
      editable={editable}
      roster={roster}
      chatter={{
        initial: chatterPage,
        lastReadAt,
        unread: chatterPage.messages.filter(
          (m) => !m.mine && (!lastReadAt || new Date(m.createdAt) > new Date(lastReadAt))
        ).length,
        me: { id: auth.user.id, name: people.get(auth.user.id).name },
        canModerate: canManage,
        people: people.list.map(({ id, name, avatarUrl }) => ({ id, name, avatarUrl })),
        gifsEnabled: !!process.env.GIPHY_API_KEY,
      }}
    />
  );
}
