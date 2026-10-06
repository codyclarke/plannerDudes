import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addPlacesSchema } from "@/lib/validations";
import { BlockedUrlError, fetchLinkPreview } from "@/lib/link-preview.server";
import { siteUrl } from "@/lib/site-url";
import { sendPushToProfiles } from "@/lib/push";

// Anyone in the group adds one or more links (Airbnb, VRBO, hotels…) to an
// event's "Where should we stay?" list. Each gets a preview card.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS: only events in the caller's group are visible.
  const { data: event } = await supabase
    .from("events")
    .select("id, title, group_id")
    .eq("id", eventId)
    .single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = addPlacesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste at least one link." }, { status: 400 });
  }

  // Normalize so the same link pasted twice is caught by unique(event_id, url).
  const urls = [
    ...new Set(
      parsed.data.urls.map((u) => {
        try {
          return new URL(u).toString();
        } catch {
          return u;
        }
      })
    ),
  ];
  const { data: existing } = await supabase.from("event_places").select("url").eq("event_id", eventId);
  const already = new Set((existing ?? []).map((p) => p.url));
  const fresh = urls.filter((u) => !already.has(u));

  const results = await Promise.all(
    fresh.map(async (url) => {
      try {
        return { url, preview: await fetchLinkPreview(url) };
      } catch (err) {
        return { url, error: err instanceof BlockedUrlError ? err.message : "Couldn't add that link." };
      }
    })
  );

  const toInsert = results.flatMap((r) =>
    "preview" in r && r.preview
      ? [
          {
            event_id: eventId,
            url: r.url,
            title: r.preview.title,
            description: r.preview.description,
            image_url: r.preview.imageUrl,
            site_name: r.preview.siteName,
            added_by: auth.user!.id,
          },
        ]
      : []
  );
  if (toInsert.length > 0) {
    const { error } = await supabase.from("event_places").insert(toInsert);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // One push per paste (not per link) to everyone else in the group.
    const [{ data: me }, { data: others }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", auth.user.id).single(),
      supabase.from("profiles").select("id").eq("group_id", event.group_id).neq("id", auth.user.id),
    ]);
    const n = toInsert.length;
    await sendPushToProfiles((others ?? []).map((p) => p.id), {
      title: "🏠 Where should we stay?",
      body: `${me?.display_name ?? "Someone"} added ${n === 1 ? "a place" : `${n} places`} for ${event.title} — vote!`,
      url: `${siteUrl(request)}/events/${eventId}`,
    });
  }

  return NextResponse.json({
    ok: true,
    added: toInsert.length,
    duplicates: urls.length - fresh.length,
    errors: results.flatMap((r) => ("error" in r && r.error ? [{ url: r.url, error: r.error }] : [])),
  });
}
