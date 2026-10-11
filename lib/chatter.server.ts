import { MESSAGE_PAGE_SIZE, type ChatterPage, type MessageView } from "./chatter";
import type { Person } from "./people";
import { groupReactions } from "./reactions";
import type { createClient } from "./supabase/server";
import type { Database } from "./supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type MessageRow = Database["public"]["Tables"]["event_messages"]["Row"];

/**
 * A page of an event's chat (newest `limit` messages, or those before
 * `before`), oldest first, plus its pinned ideas. Read through the caller's
 * RLS-scoped client.
 */
export async function loadChatter(
  supabase: ServerClient,
  eventId: string,
  myId: string,
  person: (id: string) => Person,
  { limit = MESSAGE_PAGE_SIZE, before }: { limit?: number; before?: string } = {}
): Promise<ChatterPage> {
  let page = supabase
    .from("event_messages")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  if (before) page = page.lt("created_at", before);

  const [{ data: rows }, { data: pinnedRows }, { count }] = await Promise.all([
    page,
    supabase
      .from("event_messages")
      .select("*")
      .eq("event_id", eventId)
      .not("pinned_at", "is", null)
      .order("pinned_at"),
    supabase.from("event_messages").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  const newest = (rows ?? []).slice(0, limit);
  const pinned = pinnedRows ?? [];

  const ids = [...new Set([...newest, ...pinned].map((m) => m.id))];
  const { data: reactionRows } = ids.length
    ? await supabase.from("message_reactions").select("*").in("message_id", ids)
    : { data: [] };
  const reactions = groupReactions(
    (reactionRows ?? []).map((r) => ({ ...r, target_id: r.message_id })),
    myId,
    (id) => person(id).name
  );

  const toView = (m: MessageRow): MessageView => {
    const author = person(m.author_id);
    return {
      id: m.id,
      authorId: m.author_id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      body: m.body,
      createdAt: m.created_at,
      editedAt: m.edited_at,
      isIdea: m.is_idea,
      pinned: !!m.pinned_at,
      mentionNames: m.mentions.map((id) => person(id).name),
      reactions: reactions.get(m.id) ?? [],
      mine: m.author_id === myId,
    };
  };

  return {
    messages: newest.reverse().map(toView),
    pinned: pinned.map(toView),
    hasMore: (rows ?? []).length > limit,
    total: count ?? newest.length,
  };
}

/** When the viewer last read each event's chat (null = never). */
export async function loadLastRead(supabase: ServerClient, eventIds: string[], myId: string) {
  const { data } = eventIds.length
    ? await supabase.from("event_reads").select("event_id, last_read_at").eq("profile_id", myId).in("event_id", eventIds)
    : { data: [] };
  return new Map((data ?? []).map((r) => [r.event_id, r.last_read_at]));
}

/** Messages from other people since the viewer last read each event's chat. */
export async function loadUnreadCounts(supabase: ServerClient, eventIds: string[], myId: string) {
  const [{ data: messages }, lastRead] = await Promise.all([
    eventIds.length
      ? supabase.from("event_messages").select("event_id, created_at").in("event_id", eventIds).neq("author_id", myId)
      : Promise.resolve({ data: [] as { event_id: string; created_at: string }[] }),
    loadLastRead(supabase, eventIds, myId),
  ]);
  const unread = new Map<string, number>();
  for (const m of messages ?? []) {
    const read = lastRead.get(m.event_id);
    if (!read || new Date(m.created_at) > new Date(read)) unread.set(m.event_id, (unread.get(m.event_id) ?? 0) + 1);
  }
  return unread;
}

/** Organizer or app owner: may delete anyone's message and pin ideas. */
export async function canModerateEvent(supabase: ServerClient, organizerId: string, myId: string) {
  if (organizerId === myId) return true;
  const { data: me } = await supabase.from("profiles").select("is_owner").eq("id", myId).single();
  return !!me?.is_owner;
}
