import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateEventImageSchema } from "@/lib/validations";
import { EVENT_IMAGES_BUCKET, isOwnImagePath } from "@/lib/images";
import { deleteImage } from "@/lib/images.server";

// Sets (or, with null, removes) an event's cover image. Organizer only.
export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("organizer_id, image_path")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (event.organizer_id !== auth.user.id) {
    return NextResponse.json({ error: "only the organizer can change the cover" }, { status: 403 });
  }

  const parsed = updateEventImageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { imagePath } = parsed.data;
  if (imagePath && !isOwnImagePath(imagePath, auth.user.id)) {
    return NextResponse.json({ error: "invalid image" }, { status: 400 });
  }

  const { error } = await supabase.from("events").update({ image_path: imagePath }).eq("id", eventId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The old file is no longer referenced anywhere; clean it up.
  if (event.image_path && event.image_path !== imagePath) {
    await deleteImage(EVENT_IMAGES_BUCKET, event.image_path);
  }

  return NextResponse.json({ ok: true });
}
