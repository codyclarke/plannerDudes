import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voteBatchSchema } from "@/lib/validations";

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
    .select("status")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.status !== "polling") {
    return NextResponse.json({ error: "voting is closed for this event" }, { status: 409 });
  }

  // Confirm every option actually belongs to this event, so a crafted
  // payload can't vote on options from a different event.
  const { data: options } = await supabase
    .from("event_options")
    .select("id")
    .eq("event_id", eventId);
  const validOptionIds = new Set((options ?? []).map((o) => o.id));
  if (parsed.data.votes.some((v) => !validOptionIds.has(v.eventOptionId))) {
    return NextResponse.json({ error: "option does not belong to this event" }, { status: 400 });
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
