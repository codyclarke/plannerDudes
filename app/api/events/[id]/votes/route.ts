import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voteBatchSchema } from "@/lib/validations";
import { isVotingClosed } from "@/lib/voting-deadline";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = voteBatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("status, finalized_option_id, voting_closes_at")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // While polling (and before any closing date), any of the event's dates can
  // be voted on. Once a date is locked in, RSVPs stay open for that date only.
  // Mirrors the votes RLS policy.
  let allowedOptionIds: Set<string>;
  if (event.status === "polling") {
    if (isVotingClosed(event.voting_closes_at, new Date())) {
      return NextResponse.json(
        { error: "Voting has closed — the organizer is picking the date." },
        { status: 409 }
      );
    }
    const { data: options } = await supabase
      .from("event_options")
      .select("id")
      .eq("event_id", eventId);
    allowedOptionIds = new Set((options ?? []).map((o) => o.id));
  } else if (event.status === "finalized" && event.finalized_option_id) {
    allowedOptionIds = new Set([event.finalized_option_id]);
  } else {
    return NextResponse.json({ error: "this event is closed" }, { status: 409 });
  }
  if (parsed.data.votes.some((v) => !allowedOptionIds.has(v.eventOptionId))) {
    return NextResponse.json(
      {
        error:
          event.status === "finalized"
            ? "the date is locked in — you can only RSVP for that date"
            : "option does not belong to this event",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("votes").upsert(
    parsed.data.votes.map((v) => ({
      event_option_id: v.eventOptionId,
      profile_id: auth.user!.id,
      response: v.response,
      adults_count: v.adultsCount,
      kids_count: v.kidsCount,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "event_option_id,profile_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
