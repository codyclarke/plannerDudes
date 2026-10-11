import { createAdminClient } from "./supabase/admin";
import { sendPushToProfiles } from "./push";

/** After a reaction push, further reactions on that event stay quiet this long. */
const QUIET_MS = 60 * 60 * 1000;

/**
 * Tells someone their RSVP got a reaction — throttled: the first reaction
 * pushes right away, the rest within the next hour are silent, and the next
 * push after that mentions them ("+3 more").
 */
export async function notifyReaction({
  eventId,
  eventTitle,
  targetId,
  reactorName,
  emoji,
  eventUrl,
}: {
  eventId: string;
  eventTitle: string;
  targetId: string;
  reactorName: string;
  emoji: string;
  eventUrl: string;
}) {
  const admin = createAdminClient();
  await admin
    .from("reaction_push_log")
    .upsert({ event_id: eventId, target_id: targetId }, { onConflict: "event_id,target_id", ignoreDuplicates: true });
  const { data: log } = await admin
    .from("reaction_push_log")
    .select("last_sent_at")
    .eq("event_id", eventId)
    .eq("target_id", targetId)
    .single();
  if (!log || Date.now() - new Date(log.last_sent_at).getTime() < QUIET_MS) return;

  // Claim this send: only succeeds if nobody else updated it since we read
  // it, so two reactions at once can't both push.
  const { data: claimed } = await admin
    .from("reaction_push_log")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("target_id", targetId)
    .eq("last_sent_at", log.last_sent_at)
    .select("event_id");
  if (!claimed?.length) return;

  // Reactions since the last push (this one included) that went unannounced.
  const { count } = await admin
    .from("rsvp_reactions")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("target_id", targetId)
    .neq("reactor_id", targetId)
    .gt("created_at", log.last_sent_at);
  const more = Math.max((count ?? 1) - 1, 0);

  await sendPushToProfiles([targetId], {
    title: `${reactorName} reacted ${emoji} to your RSVP`,
    body: more > 0 ? `${eventTitle} · +${more} more ${more === 1 ? "reaction" : "reactions"}` : eventTitle,
    url: eventUrl,
  });
}
