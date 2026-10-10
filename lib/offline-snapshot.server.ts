import { loadDashboard } from "./dashboard.server";
import { eventEmoji } from "./emoji";
import type { createClient } from "./supabase/server";
import type { OfflineEvent, OfflineSnapshot } from "./offline-snapshot";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Builds the read-only offline copy of `myId`'s upcoming events. Pass the
 * caller's own (RLS-scoped) client so it only contains what they can see.
 */
export async function buildOfflineSnapshot(supabase: ServerClient, myId: string): Promise<OfflineSnapshot> {
  const { myName, cards, upcoming, options, votes, people } = await loadDashboard(supabase, myId, {
    withImages: false, // signed image URLs expire within the hour — useless offline
  });

  const eventIds = upcoming.map((e) => e.id);
  const { data: places } = eventIds.length
    ? await supabase.from("event_places").select("*").in("event_id", eventIds).order("created_at")
    : { data: [] };
  const placeIds = (places ?? []).map((p) => p.id);
  const { data: placeVotes } = placeIds.length
    ? await supabase.from("place_votes").select("*").in("place_id", placeIds)
    : { data: [] };
  const name = (id: string) => people.get(id).name;

  const events: Record<string, OfflineEvent> = {};
  for (const event of upcoming) {
    const eventOptions = options.filter((o) => o.event_id === event.id);
    const optionVotes = (optionId: string) => votes.filter((v) => v.event_option_id === optionId);
    const finalVotes = event.finalized_option_id ? optionVotes(event.finalized_option_id) : [];

    events[event.id] = {
      id: event.id,
      title: event.title,
      emoji: eventEmoji(event.title, event.emoji),
      description: event.description,
      location: event.location,
      spousesInvited: event.spouses_invited,
      kidsAllowed: event.kids_allowed,
      status: event.status,
      fixedDate: event.fixed_date,
      organizerName: name(event.organizer_id),
      votingClosesAt: event.voting_closes_at,
      options: eventOptions.map((o) => {
        const v = optionVotes(o.id);
        return {
          id: o.id,
          startsAt: o.starts_at,
          allDay: o.all_day,
          label: o.label,
          yes: v.filter((x) => x.response === "yes").length,
          maybe: v.filter((x) => x.response === "maybe").length,
          no: v.filter((x) => x.response === "no").length,
          yesNames: v.filter((x) => x.response === "yes").map((x) => name(x.profile_id)),
          myResponse: v.find((x) => x.profile_id === myId)?.response ?? null,
        };
      }),
      finalizedOptionId: event.finalized_option_id,
      going: finalVotes
        .filter((v) => v.response === "yes")
        .map((v) => ({ name: name(v.profile_id), adults: v.adults_count, kids: v.kids_count })),
      maybeNames: finalVotes.filter((v) => v.response === "maybe").map((v) => name(v.profile_id)),
      places: (places ?? [])
        .filter((p) => p.event_id === event.id)
        .map((p) => {
          const v = (placeVotes ?? []).filter((x) => x.place_id === p.id);
          return {
            id: p.id,
            title: p.title,
            url: p.url,
            siteName: p.site_name,
            yes: v.filter((x) => x.response === "yes").length,
            maybe: v.filter((x) => x.response === "maybe").length,
            no: v.filter((x) => x.response === "no").length,
            myResponse: v.find((x) => x.profile_id === myId)?.response ?? null,
          };
        }),
      chosenPlaceId: event.chosen_place_id,
    };
  }

  return {
    version: 1,
    userId: myId,
    myName,
    savedAt: new Date().toISOString(),
    dashboard: cards,
    events,
  };
}
