import { formatWhen } from "@/lib/format";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type OptionRow = Database["public"]["Tables"]["event_options"]["Row"];

// Locked-in events first, soonest first; then events still being voted on.
// Past (by more than a few hours) and cancelled events are hidden.
function pickUpcoming(events: EventRow[], options: OptionRow[]) {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  const startOf = (e: EventRow) =>
    new Date(options.find((o) => o.id === e.finalized_option_id)?.starts_at ?? 0).getTime();
  const finalized = events
    .filter((e) => e.status === "finalized" && startOf(e) >= cutoff)
    .sort((a, b) => startOf(a) - startOf(b));
  const polling = events.filter((e) => e.status === "polling");
  return [...finalized, ...polling];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (!events || events.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Upcoming events</h1>
        <p className="mt-2 text-neutral-500">No events yet — create one.</p>
      </div>
    );
  }

  const eventIds = events.map((e) => e.id);
  const { data: options } = await supabase
    .from("event_options")
    .select("*")
    .in("event_id", eventIds)
    .order("sort_order", { ascending: true });

  const optionIds = (options ?? []).map((o) => o.id);
  const { data: votes } = optionIds.length
    ? await supabase.from("votes").select("*").in("event_option_id", optionIds)
    : { data: [] };
  const { data: profiles } = await supabase.from("profiles").select("id, display_name");

  const nameOf = (profileId: string) =>
    profiles?.find((p) => p.id === profileId)?.display_name ?? "Someone";

  const visible = pickUpcoming(events, options ?? []);

  if (visible.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Upcoming events</h1>
        <p className="mt-2 text-neutral-500">Nothing coming up — create an event.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Upcoming events</h1>
      {visible.map((event) => {
        const eventOptions = (options ?? []).filter((o) => o.event_id === event.id);
        const finalizedOption = eventOptions.find((o) => o.id === event.finalized_option_id);
        const yesVotesForFinalized = finalizedOption
          ? (votes ?? []).filter(
              (v) => v.event_option_id === finalizedOption.id && v.response === "yes"
            )
          : [];

        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="rounded border p-4 transition hover:bg-neutral-50"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">{event.title}</h2>
              <span className="text-xs uppercase text-neutral-400">{event.status}</span>
            </div>
            {event.location && <p className="text-sm text-neutral-500">{event.location}</p>}
            <div className="mt-2 flex gap-2 text-xs text-neutral-500">
              {event.spouses_invited && <span className="rounded bg-neutral-100 px-2 py-0.5">Spouses invited</span>}
              {event.kids_allowed && <span className="rounded bg-neutral-100 px-2 py-0.5">Kids allowed</span>}
            </div>
            {event.status === "finalized" && finalizedOption ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">
                  {formatWhen(finalizedOption.starts_at)}
                </p>
                <p className="text-neutral-500">
                  Going:{" "}
                  {yesVotesForFinalized.length > 0
                    ? yesVotesForFinalized
                        .map(
                          (v) =>
                            `${nameOf(v.profile_id)}${
                              v.adults_count + v.kids_count > 0
                                ? ` (+${v.adults_count + v.kids_count})`
                                : ""
                            }`
                        )
                        .join(", ")
                    : "no one yet"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">
                Voting in progress — {eventOptions.length} option{eventOptions.length === 1 ? "" : "s"}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
