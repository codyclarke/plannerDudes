import { NextResponse } from "next/server";
import type { createClient } from "./supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Loads an event the signed-in user may manage (edit details, fix poll
 * dates, delete): its organizer, or the app owner. Returns either the event
 * or a ready-made error response.
 *
 * The event is fetched through RLS, so it's always in the caller's group.
 * Callers then write with the admin client — RLS only grants these writes to
 * the organizer, and the owner needs them too.
 */
export async function loadManageableEvent(supabase: ServerClient, eventId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }

  const [{ data: event }, { data: me }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).single(),
    supabase.from("profiles").select("is_owner, display_name").eq("id", auth.user.id).single(),
  ]);
  if (!event) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) } as const;
  }
  if (event.organizer_id !== auth.user.id && !me?.is_owner) {
    return {
      error: NextResponse.json({ error: "Only the organizer can change this event." }, { status: 403 }),
    } as const;
  }
  return { event, userId: auth.user.id, myName: me?.display_name ?? "Someone" } as const;
}
