import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_PAGE_SIZE, findMentions } from "@/lib/chatter";
import { loadChatter } from "@/lib/chatter.server";
import { notifyMentions } from "@/lib/chatter-push.server";
import { loadPeople } from "@/lib/people.server";
import { siteUrl } from "@/lib/site-url";
import { postMessageSchema } from "@/lib/validations";

// The event's chat: newest page (?limit=), or older messages (?before=<iso>).
// The browser refetches this whenever a live update arrives.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || MESSAGE_PAGE_SIZE, 1), 500);
  const before = params.get("before") ?? undefined;
  if (before && Number.isNaN(Date.parse(before))) {
    return NextResponse.json({ error: "invalid cursor" }, { status: 400 });
  }

  const people = await loadPeople(supabase);
  // RLS: only events in the caller's group return any messages.
  const page = await loadChatter(supabase, eventId, auth.user.id, people.get, { limit, before });
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}

// Post a message (optionally as a 💡 idea). @mentioned people get a push.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const myId = auth.user.id;

  const parsed = postMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Messages need some text (up to 1,000 characters)." }, { status: 400 });
  }
  const { body, isIdea } = parsed.data;

  // RLS: the event is only visible within the caller's group.
  const { data: event } = await supabase.from("events").select("id, title").eq("id", eventId).single();
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const people = await loadPeople(supabase, { withAvatars: false });
  const mentions = findMentions(body, people.list).filter((id) => id !== myId);

  const { data: message, error } = await supabase
    .from("event_messages")
    .insert({ event_id: eventId, author_id: myId, body, is_idea: isIdea, mentions })
    .select("id")
    .single();
  if (error || !message) {
    return NextResponse.json({ error: error?.message ?? "couldn't post" }, { status: 500 });
  }

  if (mentions.length) {
    const push = {
      mentionedIds: mentions,
      authorName: people.get(myId).name,
      eventTitle: event.title,
      body,
      eventUrl: `${siteUrl(request)}/events/${eventId}#chatter`,
    };
    after(() => notifyMentions(push));
  }
  return NextResponse.json({ ok: true, id: message.id });
}
