import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { editEventSchema } from "@/lib/validations";
import { loadManageableEvent } from "@/lib/event-access.server";
import { EVENT_IMAGES_BUCKET } from "@/lib/images";
import { deleteImage } from "@/lib/images.server";
import { sendEventCancelledEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";

// Organizer (or app owner) edits an event's details. Quiet: no notifications.
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const loaded = await loadManageableEvent(await createClient(), eventId);
  if ("error" in loaded) return loaded.error;
  const { event } = loaded;

  const parsed = editEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
  }
  const input = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("events")
    .update({
      title: input.title,
      emoji: input.emoji ?? null,
      description: input.description || null,
      location: input.location || null,
      spouses_invited: input.spousesInvited,
      kids_allowed: input.kidsAllowed,
    })
    .eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Turning partners/kids off drops the +adults/+kids people already added,
  // so headcounts don't keep counting guests who are no longer invited.
  const turnedOffPartners = event.spouses_invited && !input.spousesInvited;
  const turnedOffKids = event.kids_allowed && !input.kidsAllowed;
  if (turnedOffPartners || turnedOffKids) {
    const { data: options } = await admin.from("event_options").select("id").eq("event_id", eventId);
    const optionIds = (options ?? []).map((o) => o.id);
    if (optionIds.length) {
      await admin
        .from("votes")
        .update({
          ...(turnedOffPartners ? { adults_count: 0 } : {}),
          ...(turnedOffKids ? { kids_count: 0 } : {}),
        })
        .in("event_option_id", optionIds);
    }
  }

  return NextResponse.json({ ok: true });
}

// Organizer (or app owner) deletes an event. If anyone else had already
// voted or RSVP'd, they're told it's called off; otherwise it's a quiet
// "oops" delete.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const loaded = await loadManageableEvent(await createClient(), eventId);
  if ("error" in loaded) return loaded.error;
  const { event, userId, myName } = loaded;

  const admin = createAdminClient();
  const responders = await respondersTo(admin, event.id, [event.organizer_id, userId]);

  // Options, votes, places and their votes cascade with the event row.
  const { error } = await admin.from("events").delete().eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await deleteImage(EVENT_IMAGES_BUCKET, event.image_path);

  if (responders.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("email").in("id", responders);
    await sendEventCancelledEmail({
      to: (profiles ?? []).map((p) => p.email),
      deletedByName: myName,
      title: event.title,
    });
    await sendPushToProfiles(responders, {
      title: "❌ Called off",
      body: `${myName} called off ${event.title}.`,
      url: "/dashboard",
    });
  }

  return NextResponse.json({ ok: true, notified: responders.length });
}

/** People (other than `exclude`) who voted, RSVP'd or voted on a place. */
async function respondersTo(admin: ReturnType<typeof createAdminClient>, eventId: string, exclude: string[]) {
  const [{ data: options }, { data: places }] = await Promise.all([
    admin.from("event_options").select("id").eq("event_id", eventId),
    admin.from("event_places").select("id").eq("event_id", eventId),
  ]);
  const optionIds = (options ?? []).map((o) => o.id);
  const placeIds = (places ?? []).map((p) => p.id);
  const [{ data: votes }, { data: placeVotes }] = await Promise.all([
    optionIds.length
      ? admin.from("votes").select("profile_id").in("event_option_id", optionIds)
      : Promise.resolve({ data: [] as { profile_id: string }[] }),
    placeIds.length
      ? admin.from("place_votes").select("profile_id").in("place_id", placeIds)
      : Promise.resolve({ data: [] as { profile_id: string }[] }),
  ]);
  const ids = new Set([...(votes ?? []), ...(placeVotes ?? [])].map((v) => v.profile_id));
  for (const id of exclude) ids.delete(id);
  return [...ids];
}
