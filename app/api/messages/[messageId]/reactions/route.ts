import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_REACTIONS_PER_PERSON } from "@/lib/reactions";
import { messageReactionSchema } from "@/lib/validations";

// Add or remove one of your emoji reactions on a chat message. No push —
// chat activity only shows up as badges.
export async function POST(request: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const myId = auth.user.id;

  const parsed = messageReactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid reaction" }, { status: 400 });
  }
  const { emoji, add } = parsed.data;

  if (!add) {
    // RLS: people can only delete their own reactions.
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .match({ message_id: messageId, reactor_id: myId, emoji });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // RLS: only messages on events in the caller's group are visible.
  const { data: message } = await supabase.from("event_messages").select("id, event_id").eq("id", messageId).single();
  if (!message) {
    return NextResponse.json({ error: "That message was deleted." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("reactor_id", myId);
  if (existing?.some((r) => r.emoji === emoji)) {
    return NextResponse.json({ ok: true }); // already there (double tap)
  }
  if ((existing?.length ?? 0) >= MAX_REACTIONS_PER_PERSON) {
    return NextResponse.json({ error: "that's plenty of reactions 😅" }, { status: 400 });
  }

  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, event_id: message.event_id, reactor_id: myId, emoji });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
