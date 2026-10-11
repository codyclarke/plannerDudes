import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findMentions } from "@/lib/chatter";
import { canModerateEvent } from "@/lib/chatter.server";
import { notifyMentions } from "@/lib/chatter-push.server";
import { loadPeople } from "@/lib/people.server";
import { siteUrl } from "@/lib/site-url";
import { updateMessageSchema } from "@/lib/validations";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The message (read through RLS, so it's in the caller's group), its event,
 * and what the caller may do with it. Writes then use the admin client.
 */
async function loadForChange(supabase: ServerClient, messageId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  }
  const { data: message } = await supabase.from("event_messages").select("*").eq("id", messageId).single();
  if (!message) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) } as const;
  }
  const { data: event } = await supabase
    .from("events")
    .select("id, title, organizer_id")
    .eq("id", message.event_id)
    .single();
  if (!event) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) } as const;
  }
  const myId = auth.user.id;
  return {
    message,
    event,
    myId,
    isAuthor: message.author_id === myId,
    canModerate: await canModerateEvent(supabase, event.organizer_id, myId),
  } as const;
}

// Author edits the text; organizer / app owner pins or unpins an idea.
export async function PATCH(request: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await ctx.params;
  const supabase = await createClient();
  const loaded = await loadForChange(supabase, messageId);
  if ("error" in loaded) return loaded.error;
  const { message, event, myId, isAuthor, canModerate } = loaded;

  const parsed = updateMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Messages need some text (up to 1,000 characters)." }, { status: 400 });
  }
  const admin = createAdminClient();

  if ("pinned" in parsed.data) {
    if (!canModerate) {
      return NextResponse.json({ error: "Only the organizer can pin ideas." }, { status: 403 });
    }
    if (!message.is_idea) {
      return NextResponse.json({ error: "Only 💡 ideas can be pinned." }, { status: 400 });
    }
    const { error } = await admin
      .from("event_messages")
      .update({ pinned_at: parsed.data.pinned ? new Date().toISOString() : null })
      .eq("id", messageId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!isAuthor) {
    return NextResponse.json({ error: "You can only edit your own messages." }, { status: 403 });
  }
  const { body } = parsed.data;
  if (body === message.body) return NextResponse.json({ ok: true });

  const people = await loadPeople(supabase, { withAvatars: false });
  const mentions = findMentions(body, people.list).filter((id) => id !== myId);
  const { error } = await admin
    .from("event_messages")
    .update({ body, mentions, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Only people newly @mentioned by the edit get a push.
  const added = mentions.filter((id) => !message.mentions.includes(id));
  if (added.length) {
    const push = {
      mentionedIds: added,
      authorName: people.get(myId).name,
      eventTitle: event.title,
      body,
      eventUrl: `${siteUrl(request)}/events/${event.id}#chatter`,
    };
    after(() => notifyMentions(push));
  }
  return NextResponse.json({ ok: true });
}

// The author, the organizer or the app owner removes a message.
export async function DELETE(_request: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await ctx.params;
  const loaded = await loadForChange(await createClient(), messageId);
  if ("error" in loaded) return loaded.error;
  if (!loaded.isAuthor && !loaded.canModerate) {
    return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  }

  // Its reactions cascade.
  const { error } = await createAdminClient().from("event_messages").delete().eq("id", messageId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
