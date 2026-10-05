import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { buildIcsFile } from "@/lib/ics";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS (events_select) already limits this to events the caller organizes
  // or is invited to; a non-participant gets no row, same as a 404.
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!event || event.status !== "finalized" || !event.finalized_option_id) {
    return NextResponse.json({ error: "event is not finalized" }, { status: 404 });
  }

  const { data: option } = await supabase
    .from("event_options")
    .select("*")
    .eq("id", event.finalized_option_id)
    .single();
  if (!option) {
    return NextResponse.json({ error: "finalized option not found" }, { status: 404 });
  }

  const ics = buildIcsFile({
    eventId,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: option.starts_at,
    endsAt: option.ends_at,
    allDay: option.all_day,
    url: `${siteUrl(request)}/events/${eventId}`,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.title.replace(/[^a-z0-9]+/gi, "-")}.ics"`,
    },
  });
}
