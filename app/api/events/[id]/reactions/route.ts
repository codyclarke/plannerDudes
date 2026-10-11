import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_REACTIONS_PER_PERSON } from "@/lib/reactions";
import { notifyReaction } from "@/lib/reaction-push.server";
import { siteUrl } from "@/lib/site-url";
import { reactionSchema } from "@/lib/validations";

// Add or remove one of your emoji reactions on someone's "I'm in" RSVP.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const myId = auth.user.id;

  const parsed = reactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid reaction" }, { status: 400 });
  }
  const { targetId, emoji, add } = parsed.data;
  const key = { event_id: eventId, target_id: targetId, reactor_id: myId, emoji };

  if (!add) {
    // RLS: people can only delete their own reactions.
    const { error } = await supabase.from("rsvp_reactions").delete().match(key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // RLS: the event (and its votes) are only visible within the group.
  const { data: event } = await supabase
    .from("events")
    .select("id, title, status, finalized_option_id")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.status !== "finalized" || !event.finalized_option_id) {
    return NextResponse.json({ error: "reactions open once the date is locked in" }, { status: 400 });
  }
  const { data: rsvp } = await supabase
    .from("votes")
    .select("profile_id")
    .eq("event_option_id", event.finalized_option_id)
    .eq("profile_id", targetId)
    .eq("response", "yes")
    .maybeSingle();
  if (!rsvp) {
    return NextResponse.json({ error: "they're not going (anymore)" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("rsvp_reactions")
    .select("emoji")
    .eq("event_id", eventId)
    .eq("target_id", targetId)
    .eq("reactor_id", myId);
  if (existing?.some((r) => r.emoji === emoji)) {
    return NextResponse.json({ ok: true }); // already there (double tap)
  }
  if ((existing?.length ?? 0) >= MAX_REACTIONS_PER_PERSON) {
    return NextResponse.json({ error: "that's plenty of reactions 😅" }, { status: 400 });
  }

  const { error } = await supabase.from("rsvp_reactions").insert(key);
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // No push for reacting to yourself; otherwise send it after responding.
  if (!error && targetId !== myId) {
    const { data: me } = await supabase.from("profiles").select("display_name").eq("id", myId).single();
    const push = {
      eventId,
      eventTitle: event.title,
      targetId,
      reactorName: me?.display_name ?? "Someone",
      emoji,
      eventUrl: `${siteUrl(request)}/events/${eventId}`,
    };
    after(() => notifyReaction(push));
  }
  return NextResponse.json({ ok: true });
}
