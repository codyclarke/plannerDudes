import { loadDashboard } from "./dashboard.server";
import { eventEmoji } from "./emoji";
import { groupReactions } from "./reactions";
import type { createClient } from "./supabase/server";
import type { OfflineEvent, OfflineSnapshot } from "./offline-snapshot";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const OFFLINE_MESSAGES_PER_EVENT = 20;

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
  const { data: reactionRows } = eventIds.length
    ? await supabase.from("rsvp_reactions").select("*").in("event_id", eventIds)
    : { data: [] };
  const name = (id: string) => people.get(id).name;

  // Latest chat messages per event (newest first here; reversed below).
  const messagePages = await Promise.all(
    eventIds.map((id) =>
      supabase
        .from("event_messages")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false })
        .limit(OFFLINE_MESSAGES_PER_EVENT)
    )
  );
  const messageRows = messagePages.flatMap((page) => page.data ?? []);
  const messageIds = messageRows.map((m) => m.id);
  const { data: messageReactionRows } = messageIds.length
    ? await supabase.from("message_reactions").select("*").in("message_id", messageIds)
    : { data: [] };
  const messageReactions = groupReactions(
    (messageReactionRows ?? []).map((r) => ({ ...r, target_id: r.message_id })),
    myId,
    name
  );

  const events: Record<string, OfflineEvent> = {};
  for (const event of upcoming) {
    const eventOptions = options.filter((o) => o.event_id === event.id);
    const optionVotes = (optionId: string) => votes.filter((v) => v.event_option_id === optionId);
    const finalVotes = event.finalized_option_id ? optionVotes(event.finalized_option_id) : [];
    const reactions = groupReactions(
      (reactionRows ?? []).filter((r) => r.event_id === event.id),
      myId,
      name
    );

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
        .map((v) => ({
          name: name(v.profile_id),
          adults: v.adults_count,
          kids: v.kids_count,
          reactions: (reactions.get(v.profile_id) ?? []).map(({ emoji, count, names }) => ({ emoji, count, names })),
        })),
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
      messages: messageRows
        .filter((m) => m.event_id === event.id)
        .reverse()
        .map((m) => ({
          id: m.id,
          authorName: name(m.author_id),
          body: m.body,
          createdAt: m.created_at,
          edited: !!m.edited_at,
          isIdea: m.is_idea,
          pinned: !!m.pinned_at,
          mentionNames: m.mentions.map(name),
          mine: m.author_id === myId,
          reactions: (messageReactions.get(m.id) ?? []).map(({ emoji, count, names }) => ({ emoji, count, names })),
        })),
    };
  }

  return {
    version: 1,
    userId: myId,
    myName,
    savedAt: new Date().toISOString(),
    // "New message" badges can't be cleared offline, so leave them out.
    dashboard: cards.map((card) => ({ ...card, unreadMessages: 0 })),
    events,
  };
}
