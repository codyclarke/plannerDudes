import { formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import TallyTable from "@/components/TallyTable";
import VoteForm from "./vote-form";
import FinalizeControl from "./finalize-control";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Event not found</h1>
        <p className="text-neutral-500">
          It may have been removed, or you&apos;re not invited to it.
        </p>
      </div>
    );
  }

  const { data: options } = await supabase
    .from("event_options")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  const optionList = options ?? [];
  const optionIds = optionList.map((o) => o.id);

  const { data: tallies } = optionIds.length
    ? await supabase.from("event_option_tallies").select("*").in("event_option_id", optionIds)
    : { data: [] };

  const { data: myVotes } = optionIds.length
    ? await supabase
        .from("votes")
        .select("*")
        .in("event_option_id", optionIds)
        .eq("profile_id", auth.user.id)
    : { data: [] };

  const isOrganizer = event.organizer_id === auth.user.id;

  const tallyRows = optionList.map((o) => {
    const t = (tallies ?? []).find((t) => t.event_option_id === o.id);
    return {
      id: o.id,
      startsAt: o.starts_at,
      label: o.label,
      yes: t?.yes_count ?? 0,
      maybe: t?.maybe_count ?? 0,
      no: t?.no_count ?? 0,
      totalAttendees: t?.total_attendees ?? 0,
    };
  });

  const voteFormOptions = optionList.map((o) => {
    const v = (myVotes ?? []).find((v) => v.event_option_id === o.id);
    return {
      id: o.id,
      startsAt: o.starts_at,
      label: o.label,
      myResponse: v?.response ?? null,
      myAdults: v?.adults_count ?? 0,
      myKids: v?.kids_count ?? 0,
    };
  });

  const finalizedOption = optionList.find((o) => o.id === event.finalized_option_id);

  // Names + headcount for the finalized option, shown once a time is locked in.
  let attendeeLines: string[] = [];
  if (event.status === "finalized" && finalizedOption) {
    const { data: finalVotes } = await supabase
      .from("votes")
      .select("*")
      .eq("event_option_id", finalizedOption.id)
      .eq("response", "yes");
    const profileIds = (finalVotes ?? []).map((v) => v.profile_id);
    const { data: attendeeProfiles } = profileIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
      : { data: [] };
    attendeeLines = (finalVotes ?? []).map((v) => {
      const name = attendeeProfiles?.find((p) => p.id === v.profile_id)?.display_name ?? "Someone";
      const extra = v.adults_count + v.kids_count;
      return extra > 0 ? `${name} (+${extra})` : name;
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        {event.location && <p className="text-neutral-500">{event.location}</p>}
        {event.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}
        <div className="mt-2 flex gap-2 text-xs text-neutral-500">
          {event.spouses_invited && (
            <span className="rounded bg-neutral-100 px-2 py-0.5">Spouses invited</span>
          )}
          {event.kids_allowed && (
            <span className="rounded bg-neutral-100 px-2 py-0.5">Kids allowed</span>
          )}
          <span className="rounded bg-neutral-100 px-2 py-0.5 uppercase">{event.status}</span>
        </div>
      </div>

      {event.status === "finalized" && finalizedOption ? (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <p className="font-medium">
            Locked in: {formatWhen(finalizedOption.starts_at)}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            Going: {attendeeLines.length > 0 ? attendeeLines.join(", ") : "no one yet"}
          </p>
          {/* Plain <a>: next/link would prefetch/route-transition a file download. */}
          <a
            href={`/api/events/${eventId}/ics`}
            download
            className="mt-3 inline-block rounded bg-black px-3 py-2 text-sm text-white"
          >
            Add to calendar (.ics)
          </a>
        </div>
      ) : (
        <>
          <VoteForm eventId={eventId} options={voteFormOptions} />
          {isOrganizer && optionList.length > 0 && (
            <FinalizeControl eventId={eventId} options={optionList} />
          )}
        </>
      )}

      <div>
        <h2 className="mb-2 text-lg font-medium">Tally</h2>
        <TallyTable options={tallyRows} finalizedOptionId={event.finalized_option_id} />
      </div>
    </div>
  );
}
