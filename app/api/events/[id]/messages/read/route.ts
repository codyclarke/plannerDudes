import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The viewer has seen the latest messages: clears their "new" badges.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS: own row only, and only for events in the caller's group.
  const { error } = await supabase
    .from("event_reads")
    .upsert(
      { event_id: eventId, profile_id: auth.user.id, last_read_at: new Date().toISOString() },
      { onConflict: "event_id,profile_id" }
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
