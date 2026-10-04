import { formatWhen } from "@/lib/format";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeSchema } from "@/lib/validations";
import { sendEventFinalizedEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "only the organizer can finalize" }, { status: 403 });
  }
  if (event.status !== "polling") {
    return NextResponse.json({ error: "event is not open for finalizing" }, { status: 409 });
  }

  const json = await request.json();
  const parsed = finalizeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: option } = await supabase
    .from("event_options")
    .select("*")
    .eq("id", parsed.data.eventOptionId)
    .eq("event_id", eventId)
    .single();
  if (!option) {
    return NextResponse.json({ error: "option does not belong to this event" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "finalized", finalized_option_id: option.id })
    .eq("id", eventId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: invitees } = await supabase
    .from("event_invitees")
    .select("profile_id")
    .eq("event_id", eventId);
  const recipientIds = [...new Set([...(invitees ?? []).map((i) => i.profile_id), auth.user.id])];
  const { data: recipientProfiles } = await supabase
    .from("profiles")
    .select("email")
    .in("id", recipientIds);

  const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/events/${eventId}`;
  await sendEventFinalizedEmail({
    to: (recipientProfiles ?? []).map((p) => p.email),
    title: event.title,
    whenText: formatWhen(option.starts_at),
    eventUrl,
  });
  await sendPushToProfiles(recipientIds, {
    title: "Time locked in",
    body: `${event.title} is happening ${formatWhen(option.starts_at)}`,
    url: eventUrl,
  });

  return NextResponse.json({ ok: true });
}
