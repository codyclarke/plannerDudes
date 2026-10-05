import { allDayDateKey, dateKeyInAppZone } from "@/lib/format";
import { eventEmoji } from "@/lib/emoji";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import DashboardView, { type DashboardEvent } from "./dashboard-view";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type OptionRow = Database["public"]["Tables"]["event_options"]["Row"];

// Locked-in events first, soonest first; then events still being voted on.
// Past and cancelled events are hidden: timed events a few hours after they
// start, all-day events once their date has passed in the group's timezone.
function pickUpcoming(events: EventRow[], options: OptionRow[]) {
  const now = new Date();
  const cutoff = now.getTime() - 6 * 60 * 60 * 1000;
  const today = dateKeyInAppZone(now);
  const optionOf = (e: EventRow) => options.find((o) => o.id === e.finalized_option_id);
  const startOf = (e: EventRow) => new Date(optionOf(e)?.starts_at ?? 0).getTime();
  const isUpcoming = (e: EventRow) => {
    const option = optionOf(e);
    if (!option) return false;
    return option.all_day
      ? allDayDateKey(option.starts_at) >= today
      : startOf(e) >= cutoff;
  };
  const finalized = events
    .filter((e) => e.status === "finalized" && isUpcoming(e))
    .sort((a, b) => startOf(a) - startOf(b));
  const polling = events.filter((e) => e.status === "polling");
  return [...finalized, ...polling];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const myId = auth.user.id;

  const [{ data: events }, { data: profiles }] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name"),
  ]);
  const nameOf = (profileId: string) =>
    profiles?.find((p) => p.id === profileId)?.display_name ?? "Someone";
  const myName = nameOf(myId);

  if (!events || events.length === 0) {
    return <DashboardView name={myName} events={[]} />;
  }

  const eventIds = events.map((e) => e.id);
  const [{ data: options }, { data: invitees }] = await Promise.all([
    supabase.from("event_options").select("*").in("event_id", eventIds).order("sort_order"),
    supabase.from("event_invitees").select("*").in("event_id", eventIds),
  ]);
  const optionIds = (options ?? []).map((o) => o.id);
  const { data: votes } = optionIds.length
    ? await supabase.from("votes").select("*").in("event_option_id", optionIds)
    : { data: [] };

  const cards: DashboardEvent[] = pickUpcoming(events, options ?? []).map((event) => {
    const eventOptions = (options ?? []).filter((o) => o.event_id === event.id);
    const eventOptionIds = new Set(eventOptions.map((o) => o.id));
    const eventVotes = (votes ?? []).filter((v) => eventOptionIds.has(v.event_option_id));
    const finalizedOption = eventOptions.find((o) => o.id === event.finalized_option_id);
    const going = finalizedOption
      ? eventVotes.filter((v) => v.event_option_id === finalizedOption.id && v.response === "yes")
      : [];
    const participants = new Set([
      event.organizer_id,
      ...(invitees ?? []).filter((i) => i.event_id === event.id).map((i) => i.profile_id),
    ]);
    const voters = new Set(eventVotes.map((v) => v.profile_id));

    return {
      id: event.id,
      title: event.title,
      emoji: eventEmoji(event.title, event.emoji),
      location: event.location,
      spousesInvited: event.spouses_invited,
      kidsAllowed: event.kids_allowed,
      status: event.status === "finalized" ? "finalized" : "polling",
      when: finalizedOption ? { iso: finalizedOption.starts_at, allDay: finalizedOption.all_day } : null,
      optionCount: eventOptions.length,
      goingNames: going.map((v) => nameOf(v.profile_id)),
      goingExtra: going.reduce((n, v) => n + v.adults_count + v.kids_count, 0),
      votedCount: voters.size,
      participantCount: participants.size,
      iVoted: voters.has(myId),
    };
  });

  return <DashboardView name={myName} events={cards} />;
}
