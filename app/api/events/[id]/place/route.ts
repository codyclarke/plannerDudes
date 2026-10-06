import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { choosePlaceSchema } from "@/lib/validations";
import { siteUrl } from "@/lib/site-url";
import { sendPushToProfiles } from "@/lib/push";

// Organizer picks (or un-picks, with null) where the group is staying.
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, group_id, organizer_id")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "only the organizer can pick the place" }, { status: 403 });
  }

  const parsed = choosePlaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid place" }, { status: 400 });
  }
  const { placeId } = parsed.data;

  let place: { id: string; title: string | null; site_name: string | null } | null = null;
  if (placeId) {
    const { data } = await supabase
      .from("event_places")
      .select("id, title, site_name")
      .eq("id", placeId)
      .eq("event_id", eventId)
      .single();
    if (!data) {
      return NextResponse.json({ error: "that place isn't on this event" }, { status: 400 });
    }
    place = data;
  }

  // events_update_own RLS also limits this to the organizer.
  const { error } = await supabase.from("events").update({ chosen_place_id: placeId }).eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (place) {
    const { data: others } = await supabase
      .from("profiles")
      .select("id")
      .eq("group_id", event.group_id)
      .neq("id", auth.user.id);
    await sendPushToProfiles((others ?? []).map((p) => p.id), {
      title: `📍 ${event.title}`,
      body: `We're staying at ${place.title ?? place.site_name ?? "the picked place"}!`,
      url: `${siteUrl(request)}/events/${eventId}`,
    });
  }
  return NextResponse.json({ ok: true });
}
