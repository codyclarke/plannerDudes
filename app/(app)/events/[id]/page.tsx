import { createClient } from "@/lib/supabase/server";
import { eventEmoji } from "@/lib/emoji";
import { signImages } from "@/lib/images.server";
import { EVENT_IMAGES_BUCKET } from "@/lib/images";
import { loadPeople } from "@/lib/people.server";
import EventView, { EventNotFound, type OptionView } from "./event-view";

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
    };
  });

  // "Top pick": most people attending, then most yeses, then most maybes.
  const ranked = [...optionViews].sort(
    (a, b) => b.totalAttendees - a.totalAttendees || b.yes - a.yes || b.maybe - a.maybe
  );
  const topOptionId = ranked[0] && ranked[0].yes + ranked[0].maybe > 0 ? ranked[0].id : null;

  // The event row came through RLS above, so the viewer may see its cover.
  const imageUrls = await signImages(EVENT_IMAGES_BUCKET, [event.image_path]);

  const going = allVotes
    .filter((v) => v.event_option_id === event.finalized_option_id && v.response === "yes")
    .map((v) => ({ ...people.get(v.profile_id), adults: v.adults_count, kids: v.kids_count }));

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
        imageUrl: event.image_path ? (imageUrls.get(event.image_path) ?? null) : null,
      }}
      isOrganizer={event.organizer_id === auth.user.id}
      options={optionViews}
      finalizedOptionId={event.finalized_option_id}
      topOptionId={topOptionId}
      going={going}
    />
  );
}
