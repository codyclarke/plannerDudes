import { NextResponse } from "next/server";
import { allDayDateKey, dateKeyInAppZone, formatWhen } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/supabase/types";
import { sendEventReminderEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";
import { NUDGE_COPY, RSVP_NUDGE_COPY, isVotingClosed, nudgeStage, rsvpNudgeStage } from "@/lib/voting-deadline";

type Admin = ReturnType<typeof createAdminClient>;

// Runs once a day via Vercel Cron (see vercel.json — the Hobby plan allows
// one run per day), late morning US time so pushes don't land at dawn:
//  1. day-before reminders for locked-in events
//  2. "you haven't voted" nudges as a voting deadline approaches
//  3. a heads-up to organizers whose voting has closed
//  4. "are you coming?" nudges before set-date events
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  // An unset secret must not turn into the accepted header "Bearer undefined".
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const base = siteUrl(request);

  const reminders = await sendEventReminders(admin, base, now);
  const { nudges, closedNotices } = await sendVotingNotifications(admin, base, now);
  const rsvpNudges = await sendRsvpNudges(admin, base, now);

  return NextResponse.json({ ok: true, reminders, nudges, closedNotices, rsvpNudges });
}

/**
 * Records that `type` was sent for an event, *before* sending it. The
 * unique (event_id, type) constraint makes this a claim: if the row already
 * exists (an earlier or concurrent run), we skip instead of sending twice.
 */
async function claim(admin: Admin, eventId: string, type: NotificationType) {
  const { error } = await admin.from("notifications_log").insert({ event_id: eventId, type });
  return !error;
}

async function sendEventReminders(admin: Admin, base: string, now: Date) {
  // Generous 20–32h window since this only runs daily — catches "tomorrow"
  // regardless of the exact cron time. All-day options have no meaningful
  // instant, so they match on "is the date tomorrow" in the group's zone.
  const windowStart = now.getTime() + 20 * 60 * 60 * 1000;
  const windowEnd = now.getTime() + 32 * 60 * 60 * 1000;
  const tomorrow = dateKeyInAppZone(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const { data: events } = await admin
    .from("events")
    .select("*")
    .eq("status", "finalized")
    .not("finalized_option_id", "is", null);

  let sent = 0;
  for (const event of events ?? []) {
    const { data: option } = await admin
      .from("event_options")
      .select("*")
      .eq("id", event.finalized_option_id!)
      .single();
    if (!option) continue;

    const startsAt = new Date(option.starts_at).getTime();
    const isTomorrow = option.all_day
      ? allDayDateKey(option.starts_at) === tomorrow
      : startsAt >= windowStart && startsAt <= windowEnd;
    if (!isTomorrow || !(await claim(admin, event.id, "reminder"))) continue;

    // Remind the people actually coming: Yes/Maybe on the locked-in date,
    // plus the organizer.
    const { data: attendingVotes } = await admin
      .from("votes")
      .select("profile_id")
      .eq("event_option_id", option.id)
      .in("response", ["yes", "maybe"]);
    const recipientIds = [...new Set([...(attendingVotes ?? []).map((v) => v.profile_id), event.organizer_id])];
    const { data: recipients } = await admin.from("profiles").select("email").in("id", recipientIds);

    const eventUrl = `${base}/events/${event.id}`;
    const whenText = formatWhen(option.starts_at, option.all_day);
    await sendEventReminderEmail({
      to: (recipients ?? []).map((p) => p.email),
      title: event.title,
      whenText,
      eventUrl,
    });
    await sendPushToProfiles(recipientIds, { title: "Coming up", body: `${event.title} is ${whenText}`, url: eventUrl });
    sent++;
  }
  return sent;
}

async function sendVotingNotifications(admin: Admin, base: string, now: Date) {
  const { data: events } = await admin
    .from("events")
    .select("id, title, group_id, organizer_id, voting_closes_at")
    .eq("status", "polling")
    .not("voting_closes_at", "is", null);

  let nudges = 0;
  let closedNotices = 0;
  for (const event of events ?? []) {
    const closesAt = event.voting_closes_at!;
    const eventUrl = `${base}/events/${event.id}`;

    // Voting has closed but nothing is locked in yet: nudge the organizer.
    if (isVotingClosed(closesAt, now)) {
      if (await claim(admin, event.id, "voting_closed")) {
        await sendPushToProfiles([event.organizer_id], {
          title: "🗳️ Voting closed",
          body: `Voting for ${event.title} has closed — time to lock in a date.`,
          url: eventUrl,
        });
        closedNotices++;
      }
      continue;
    }

    const stage = nudgeStage(closesAt, now);
    if (!stage || !(await claim(admin, event.id, stage))) continue;

    // Everyone in the group who hasn't voted on any of this event's dates.
    const [{ data: members }, { data: options }] = await Promise.all([
      admin.from("profiles").select("id").eq("group_id", event.group_id),
      admin.from("event_options").select("id").eq("event_id", event.id),
    ]);
    const optionIds = (options ?? []).map((o) => o.id);
    const { data: votes } = optionIds.length
      ? await admin.from("votes").select("profile_id").in("event_option_id", optionIds)
      : { data: [] };
    const voted = new Set((votes ?? []).map((v) => v.profile_id));
    const notVoted = (members ?? []).map((m) => m.id).filter((id) => !voted.has(id));
    if (notVoted.length === 0) continue;

    await sendPushToProfiles(notVoted, { title: `🗳️ Vote on ${event.title}`, body: NUDGE_COPY[stage], url: eventUrl });
    nudges += notVoted.length;
  }
  return { nudges, closedNotices };
}

async function sendRsvpNudges(admin: Admin, base: string, now: Date) {
  const { data: events } = await admin
    .from("events")
    .select("id, title, group_id, finalized_option_id")
    .eq("status", "finalized")
    .eq("fixed_date", true)
    .not("finalized_option_id", "is", null);

  let sent = 0;
  for (const event of events ?? []) {
    const { data: option } = await admin
      .from("event_options")
      .select("id, starts_at, all_day")
      .eq("id", event.finalized_option_id!)
      .single();
    if (!option) continue;

    const stage = rsvpNudgeStage(option.starts_at, option.all_day, now);
    if (!stage || !(await claim(admin, event.id, stage))) continue;

    // Everyone in the group who hasn't answered (yes, maybe or no) yet.
    const [{ data: members }, { data: answers }] = await Promise.all([
      admin.from("profiles").select("id").eq("group_id", event.group_id),
      admin.from("votes").select("profile_id").eq("event_option_id", option.id),
    ]);
    const answered = new Set((answers ?? []).map((a) => a.profile_id));
    const unanswered = (members ?? []).map((m) => m.id).filter((id) => !answered.has(id));
    if (unanswered.length === 0) continue;

    await sendPushToProfiles(unanswered, {
      title: `📅 ${event.title}`,
      body: RSVP_NUDGE_COPY[stage],
      url: `${base}/events/${event.id}`,
    });
    sent += unanswered.length;
  }
  return sent;
}
