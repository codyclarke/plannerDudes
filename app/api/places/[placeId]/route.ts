import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renamePlaceSchema } from "@/lib/validations";

// Rename or remove a place. RLS lets only the person who added it, or the
// event's organizer, do either — anyone else's change affects no rows.

export async function PATCH(request: Request, ctx: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = renamePlaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("event_places")
    .update({ title: parsed.data.title })
    .eq("id", placeId)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Only whoever added it (or the organizer) can rename it." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Votes cascade; a chosen place un-picks itself (on delete set null).
  const { data, error } = await supabase.from("event_places").delete().eq("id", placeId).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Only whoever added it (or the organizer) can remove it." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
