import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeEventDateSchema } from "@/lib/validations";
import { allDayStartsAt, dateKeyInAppZone, formatWhen } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { sendEventDateChangedEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";

// Organizer moves a set-date event. The date is updated in place, so RSVPs
// carry over and calendar files keep the same ID; everyone else is notified.
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, group_id, organizer_id, fixed_date, finalized_option_id")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "only the organizer can change the date" }, { status: 403 });
  }
  if (!event.fixed_date || !event.finalized_option_id) {
    return NextResponse.json({ error: "only set-date events can be moved" }, { status: 409 });
  }

  const parsed = changeEventDateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date } = parsed.data;
  const now = new Date();
  const inPast = date.allDay
    ? date.date < dateKeyInAppZone(now)
    : new Date(date.startsAt) <= now;
  if (inPast) {
    return NextResponse.json({ error: "Pick a date that hasn't passed yet." }, { status: 400 });
  }
  const startsAt = date.allDay ? allDayStartsAt(date.date) : date.startsAt;

  // event_options_write RLS limits this to the organizer.
  const { error } = await supabase
    .from("event_options")
    .update({ starts_at: startsAt, all_day: date.allDay, ends_at: null })
    .eq("id", event.finalized_option_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reminders and RSVP nudges are keyed to the date: let them fire again.
  const admin = createAdminClient();
  await admin
    .from("notifications_log")
    .delete()
    .eq("event_id", eventId)
    .in("type", ["reminder", "rsvp_3d", "rsvp_1d"]);

  const [{ data: me }, { data: others }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", auth.user.id).single(),
    supabase.from("profiles").select("id, email").eq("group_id", event.group_id).neq("id", auth.user.id),
  ]);
  const whenText = formatWhen(startsAt, date.allDay);
  const eventUrl = `${siteUrl(request)}/events/${eventId}`;
  const organizerName = me?.display_name ?? "The organizer";
  await sendEventDateChangedEmail({
    to: (others ?? []).map((p) => p.email),
    organizerName,
    title: event.title,
    whenText,
    eventUrl,
  });
  await sendPushToProfiles((others ?? []).map((p) => p.id), {
    title: "📅 New date",
    body: `${event.title} moved to ${whenText}`,
    url: eventUrl,
  });

  return NextResponse.json({ ok: true });
}
