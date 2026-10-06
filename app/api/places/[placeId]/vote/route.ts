import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { placeVoteSchema } from "@/lib/validations";

// Yes / Maybe / No on a place to stay. Saved on tap (no batch Save button).
export async function POST(request: Request, ctx: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = placeVoteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid vote" }, { status: 400 });
  }

  // RLS: only places on events in the caller's group are visible/votable.
  const { data: place } = await supabase.from("event_places").select("id").eq("id", placeId).single();
  if (!place) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await supabase.from("place_votes").upsert(
    {
      place_id: placeId,
      profile_id: auth.user.id,
      response: parsed.data.response,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "place_id,profile_id" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
