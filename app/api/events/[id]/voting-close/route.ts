import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateVotingCloseSchema } from "@/lib/validations";

const NUDGES_AND_CLOSE_NOTICE = ["nudge_3d", "nudge_1d", "nudge_today", "voting_closed"] as const;

// Organizer sets, moves or removes an event's voting closing date. Moving it
// later reopens voting if it had already closed.
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("organizer_id, status")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "only the organizer can change the closing date" }, { status: 403 });
  }
  if (event.status !== "polling") {
    return NextResponse.json({ error: "this event's date is already locked in" }, { status: 409 });
  }

  const parsed = updateVotingCloseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { votingClosesAt } = parsed.data;
  if (votingClosesAt && new Date(votingClosesAt) <= new Date()) {
    return NextResponse.json({ error: "The closing date has to be in the future." }, { status: 400 });
  }

  // events_update_own RLS also limits this to the organizer.
  const { error } = await supabase
    .from("events")
    .update({ voting_closes_at: votingClosesAt })
    .eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A new deadline gets a fresh round of nudges (and a fresh "voting closed"
  // notice), so clear the old ones from the send log.
  await createAdminClient()
    .from("notifications_log")
    .delete()
    .eq("event_id", eventId)
    .in("type", [...NUDGES_AND_CLOSE_NOTICE]);

  return NextResponse.json({ ok: true });
}
