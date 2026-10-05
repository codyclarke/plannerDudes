import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { createEventSchema } from "@/lib/validations";
import { sendEventCreatedEmail } from "@/lib/email";
import { sendPushToProfiles } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { allDayStartsAt } from "@/lib/format";
import { EVENT_IMAGES_BUCKET, isOwnImagePath } from "@/lib/images";
import { deleteImage } from "@/lib/images.server";

// Deletes a partially created event (its options cascade) and its
// uploaded cover. Uses the admin client because RLS has no delete policy on events.
async function rollback(eventId: string, imagePath: string | null) {
  await createAdminClient().from("events").delete().eq("id", eventId);
  await deleteImage(EVENT_IMAGES_BUCKET, imagePath);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, group_id, display_name")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  const json = await request.json();
  const parsed = createEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  if (input.imagePath && !isOwnImagePath(input.imagePath, profile.id)) {
    return NextResponse.json({ error: "invalid image" }, { status: 400 });
  }
  const imagePath = input.imagePath ?? null;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      group_id: profile.group_id,
      organizer_id: profile.id,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      emoji: input.emoji ?? null,
      image_path: imagePath,
      spouses_invited: input.spousesInvited,
      kids_allowed: input.kidsAllowed,
    })
    .select()
    .single();
  if (eventError || !event) {
    await deleteImage(EVENT_IMAGES_BUCKET, imagePath);
    return NextResponse.json({ error: eventError?.message ?? "failed to create event" }, { status: 500 });
  }

  const { error: optionsError } = await supabase.from("event_options").insert(
    input.options.map((opt, i) => ({
      event_id: event.id,
      starts_at: opt.allDay ? allDayStartsAt(opt.date) : opt.startsAt,
      all_day: opt.allDay,
      label: opt.label ?? null,
      sort_order: i,
    }))
  );
  if (optionsError) {
    await rollback(event.id, imagePath);
    return NextResponse.json({ error: optionsError.message }, { status: 500 });
  }

  // Every event is open to the whole group, so tell everyone except the organizer.
  const { data: others } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("group_id", profile.group_id)
    .neq("id", profile.id);

  const eventUrl = `${siteUrl(request)}/events/${event.id}`;
  await sendEventCreatedEmail({
    to: (others ?? []).map((p) => p.email),
    organizerName: profile.display_name,
    title: event.title,
    eventUrl,
  });
  await sendPushToProfiles((others ?? []).map((p) => p.id), {
    title: "New event",
    body: `${profile.display_name} proposed "${event.title}" — vote on a time`,
    url: eventUrl,
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
