import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_DATE_OPTIONS, addOptionSchema } from "@/lib/validations";
import { loadManageableEvent } from "@/lib/event-access.server";
import { allDayStartsAt, dateKeyInAppZone } from "@/lib/format";

// Organizer (or app owner) adds a candidate date to an open poll. Quiet.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const loaded = await loadManageableEvent(await createClient(), eventId);
  if ("error" in loaded) return loaded.error;
  if (loaded.event.status !== "polling") {
    return NextResponse.json({ error: "This event's date is already locked in." }, { status: 409 });
  }

  const parsed = addOptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  }
  const { option } = parsed.data;
  const inPast = option.allDay
    ? option.date < dateKeyInAppZone(new Date())
    : new Date(option.startsAt) <= new Date();
  if (inPast) {
    return NextResponse.json({ error: "That date has already passed." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("event_options")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false });
  if ((existing?.length ?? 0) >= MAX_DATE_OPTIONS) {
    return NextResponse.json({ error: `A vote can have up to ${MAX_DATE_OPTIONS} dates.` }, { status: 400 });
  }

  const { error } = await admin.from("event_options").insert({
    event_id: eventId,
    starts_at: option.allDay ? allDayStartsAt(option.date) : option.startsAt,
    all_day: option.allDay,
    label: option.label ?? null,
    sort_order: (existing?.[0]?.sort_order ?? -1) + 1,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
