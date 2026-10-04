import { formatWhen } from "@/lib/format";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEventReminderEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";

// Runs once/day via Vercel Cron (see vercel.json). Generous 20-32h window
// since it only runs daily — catches "tomorrow" regardless of exact cron time.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + 20 * 60 * 60 * 1000);
  const windowEnd = new Date(now + 32 * 60 * 60 * 1000);

  const { data: events } = await admin
    .from("events")
    .select("*")
    .eq("status", "finalized")
    .not("finalized_option_id", "is", null);

  let sentCount = 0;

  for (const event of events ?? []) {
    if (!event.finalized_option_id) continue;

    const { data: option } = await admin
      .from("event_options")
      .select("*")
      .eq("id", event.finalized_option_id)
      .single();
    if (!option) continue;

    const startsAt = new Date(option.starts_at);
    if (startsAt < windowStart || startsAt > windowEnd) continue;

    const { data: existingLog } = await admin
      .from("notifications_log")
      .select("id")
      .eq("event_id", event.id)
      .eq("type", "reminder")
      .maybeSingle();
    if (existingLog) continue;

    const { data: invitees } = await admin
      .from("event_invitees")
      .select("profile_id")
      .eq("event_id", event.id);
    const recipientIds = [...new Set([...(invitees ?? []).map((i) => i.profile_id), event.organizer_id])];
    const { data: recipientProfiles } = await admin
      .from("profiles")
      .select("email")
      .in("id", recipientIds);

    const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/events/${event.id}`;
    const whenText = formatWhen(option.starts_at);

    await sendEventReminderEmail({
      to: (recipientProfiles ?? []).map((p) => p.email),
      title: event.title,
      whenText,
      eventUrl,
    });
    await sendPushToProfiles(recipientIds, {
      title: "Coming up",
      body: `${event.title} is ${whenText}`,
      url: eventUrl,
    });

    const { error: logError } = await admin
      .from("notifications_log")
      .insert({ event_id: event.id, type: "reminder" });
    if (!logError) sentCount++;
  }

  return NextResponse.json({ ok: true, sentCount });
}
