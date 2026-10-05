import { allDayDateKey, dateKeyInAppZone, formatWhen } from "@/lib/format";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEventReminderEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";

// Runs once/day via Vercel Cron (see vercel.json). Generous 20-32h window
// since it only runs daily — catches "tomorrow" regardless of exact cron time.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  // An unset secret must not turn into the accepted header "Bearer undefined".
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + 20 * 60 * 60 * 1000);
  const windowEnd = new Date(now + 32 * 60 * 60 * 1000);
  // All-day options have no meaningful instant (stored at 12:00 UTC on their
  // date), so they're matched on "is the date tomorrow" in the group's zone.
  const tomorrow = dateKeyInAppZone(new Date(now + 24 * 60 * 60 * 1000));

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
    const isTomorrow = option.all_day
      ? allDayDateKey(option.starts_at) === tomorrow
      : startsAt >= windowStart && startsAt <= windowEnd;
    if (!isTomorrow) continue;

    const { data: existingLog } = await admin
      .from("notifications_log")
      .select("id")
      .eq("event_id", event.id)
      .eq("type", "reminder")
      .maybeSingle();
    if (existingLog) continue;

    // Events are open to the whole group, so remind the people actually
    // coming: Yes/Maybe on the locked-in date, plus the organizer.
    const { data: attendingVotes } = await admin
      .from("votes")
      .select("profile_id")
      .eq("event_option_id", option.id)
      .in("response", ["yes", "maybe"]);
    const recipientIds = [
      ...new Set([...(attendingVotes ?? []).map((v) => v.profile_id), event.organizer_id]),
    ];
    const { data: recipientProfiles } = await admin
      .from("profiles")
      .select("email")
      .in("id", recipientIds);

    const eventUrl = `${siteUrl(request)}/events/${event.id}`;
    const whenText = formatWhen(option.starts_at, option.all_day);

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
