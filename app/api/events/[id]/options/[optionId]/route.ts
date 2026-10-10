import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadManageableEvent } from "@/lib/event-access.server";

// Organizer (or app owner) removes a candidate date from an open poll. Votes
// on that date go with it (the UI warns first). A vote keeps at least 2 dates.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string; optionId: string }> }
) {
  const { id: eventId, optionId } = await ctx.params;
  const loaded = await loadManageableEvent(await createClient(), eventId);
  if ("error" in loaded) return loaded.error;
  if (loaded.event.status !== "polling") {
    return NextResponse.json({ error: "This event's date is already locked in." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: options } = await admin.from("event_options").select("id").eq("event_id", eventId);
  if (!(options ?? []).some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "That date isn't on this event." }, { status: 404 });
  }
  if ((options ?? []).length <= 2) {
    return NextResponse.json(
      { error: "A vote needs at least 2 dates — add another before removing this one." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("event_options").delete().eq("id", optionId).eq("event_id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
