// Loads the dashboard's upcoming events. Shared by the dashboard page and the
// offline snapshot so both agree on what "upcoming" means.
import { allDayDateKey, dateKeyInAppZone } from "./format";
import { eventEmoji } from "./emoji";
import { signImages } from "./images.server";
import { EVENT_IMAGES_BUCKET } from "./images";
import { loadPeople } from "./people.server";
import type { createClient } from "./supabase/server";
import type { Database } from "./supabase/types";
import { describeDeadline } from "./voting-deadline";
import type { DashboardEvent } from "@/app/(app)/dashboard/dashboard-view";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
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
    return option.all_day ? allDayDateKey(option.starts_at) >= today : startOf(e) >= cutoff;
  };
  const finalized = events
    .filter((e) => e.status === "finalized" && isUpcoming(e))
    .sort((a, b) => startOf(a) - startOf(b));
  const polling = events.filter((e) => e.status === "polling");
  return [...finalized, ...polling];
}

/**
 * Dashboard cards for `userId`, plus the raw rows behind them (reused by the
 * offline snapshot). `withImages: false` skips signing cover/avatar URLs —
 * they expire within the hour, so they're useless in an offline copy.
 */
export async function loadDashboard(
  supabase: ServerClient,
  userId: string,
  { withImages = true }: { withImages?: boolean } = {}
) {
  const [{ data: events }, people] = await Promise.all([
    supabase.from("events").select("*").order("created_at", { ascending: false }),
    loadPeople(supabase, { withAvatars: withImages }),
  ]);
  const myName = people.get(userId).name;

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: options } = eventIds.length
    ? await supabase.from("event_options").select("*").in("event_id", eventIds).order("sort_order")
    : { data: [] as OptionRow[] };
  const optionIds = (options ?? []).map((o) => o.id);
  const { data: votes } = optionIds.length
    ? await supabase.from("votes").select("*").in("event_option_id", optionIds)
    : { data: [] };

  const upcoming = pickUpcoming(events ?? [], options ?? []);
  // These rows came through RLS, so the viewer may see their covers.
  const imageUrls = withImages
    ? await signImages(EVENT_IMAGES_BUCKET, upcoming.map((e) => e.image_path))
    : new Map<string, string>();
  const now = new Date();

  const cards: DashboardEvent[] = upcoming.map((event) => {
    const eventOptions = (options ?? []).filter((o) => o.event_id === event.id);
    const eventOptionIds = new Set(eventOptions.map((o) => o.id));
    const eventVotes = (votes ?? []).filter((v) => eventOptionIds.has(v.event_option_id));
    const finalizedOption = eventOptions.find((o) => o.id === event.finalized_option_id);
    const going = finalizedOption
      ? eventVotes.filter((v) => v.event_option_id === finalizedOption.id && v.response === "yes")
      : [];
    const voters = new Set(eventVotes.map((v) => v.profile_id));

    return {
      id: event.id,
      title: event.title,
      emoji: eventEmoji(event.title, event.emoji),
      imageUrl: event.image_path ? (imageUrls.get(event.image_path) ?? null) : null,
      location: event.location,
      spousesInvited: event.spouses_invited,
      kidsAllowed: event.kids_allowed,
      status: event.status === "finalized" ? "finalized" : "polling",
      when: finalizedOption ? { iso: finalizedOption.starts_at, allDay: finalizedOption.all_day } : null,
      optionCount: eventOptions.length,
      going: going.map((v) => people.get(v.profile_id)),
      goingExtra: going.reduce((n, v) => n + v.adults_count + v.kids_count, 0),
      votedCount: voters.size,
      // Every event is open to the whole group.
      participantCount: people.list.length,
      iVoted: voters.has(userId),
      needsRsvp:
        !!finalizedOption &&
        !eventVotes.some((v) => v.event_option_id === finalizedOption.id && v.profile_id === userId),
      deadline: event.status === "polling" ? describeDeadline(event.voting_closes_at, now) : null,
    };
  });

  return { myName, cards, upcoming, options: options ?? [], votes: votes ?? [], people };
}
