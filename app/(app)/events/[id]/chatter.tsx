"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  MAX_MESSAGE_LENGTH,
  MESSAGE_PAGE_SIZE,
  dayLabel,
  fullTime,
  clockTime,
  messageDayKey,
  splitBody,
  todayKeys,
  type ChatGif,
  type ChatterPage,
  type MessageView,
} from "@/lib/chatter";
import type { GifResult } from "@/app/api/gifs/route";
import { getCounts, publishCounts, subscribeCounts } from "@/lib/chatter-store";
import type { Person } from "@/lib/people";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Button, SectionTitle, cn } from "@/components/ui";
import ReactionBar from "./reaction-bar";

/** Consecutive messages from one person within this window share a header. */
const GROUP_GAP_MS = 5 * 60 * 1000;

const STARTERS = [
  { text: "🙌 So hyped for this!", idea: false },
  { text: "💡 Idea: ", idea: true },
  { text: "🚗 Anyone want to carpool?", idea: false },
  { text: "🍿 I can bring snacks", idea: false },
];

function unreadCount(messages: MessageView[], lastReadAt: string | null) {
  const read = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter((m) => !m.mine && new Date(m.createdAt).getTime() > read).length;
}

async function fetchPage(eventId: string, query: string): Promise<ChatterPage | null> {
  const res = await fetch(`/api/events/${eventId}/messages?${query}`, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

/** "💬 12 messages · 3 new" under the event header; jumps to the chat. */
export function ChatterJumpChip({
  eventId,
  initialTotal,
  initialUnread,
}: {
  eventId: string;
  initialTotal: number;
  initialUnread: number;
}) {
  const live = useSyncExternalStore(
    subscribeCounts,
    () => getCounts(eventId),
    () => null
  );
  const total = live?.total ?? initialTotal;
  const unread = live?.unread ?? initialUnread;
  return (
    <a
      href="#chatter"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 transition active:scale-95",
        unread > 0
          ? "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/40 dark:text-fuchsia-300"
          : "bg-surface/70 text-muted ring-line hover:text-foreground"
      )}
    >
      💬{" "}
      {total === 0 ? "Start the chatter" : `${total} ${total === 1 ? "message" : "messages"}`}
      {unread > 0 && <span className="font-extrabold">· {unread} new</span>}
    </a>
  );
}

/**
 * The event's group chat: hype, 💡 ideas (the organizer can pin them),
 * @mentions and emoji reactions. Updates live; reaching the bottom marks it
 * read (clears the "new" badges).
 */
export default function Chatter({
  eventId,
  initial,
  lastReadAt: initialLastRead,
  me,
  canModerate,
  people,
  gifsEnabled,
}: {
  eventId: string;
  initial: ChatterPage;
  lastReadAt: string | null;
  me: { id: string; name: string };
  /** Organizer or app owner: delete any message, pin ideas. */
  canModerate: boolean;
  /** For @mention suggestions. */
  people: Person[];
  /** A GIPHY key is configured: show the 🎞️ GIF picker. */
  gifsEnabled: boolean;
}) {
  const [page, setPage] = useState(initial);
  // New server data (e.g. after router.refresh elsewhere on the page) wins.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setPage(initial);
  }
  const [lastReadAt, setLastReadAt] = useState(initialLastRead);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef({ count: initial.messages.length, ids: new Set<string>() });

  const unread = unreadCount(page.messages, lastReadAt);
  const today = todayKeys();

  // Keep what the live-update handlers need without re-subscribing.
  useEffect(() => {
    loadedRef.current = {
      count: page.messages.length,
      ids: new Set([...page.messages, ...page.pinned].map((m) => m.id)),
    };
    publishCounts(eventId, { total: page.total, unread });
  }, [eventId, page, unread]);

  // Live updates: any change to this event's messages or reactions refetches
  // the loaded messages (bursts are coalesced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const limit = Math.max(MESSAGE_PAGE_SIZE, loadedRef.current.count);
        const next = await fetchPage(eventId, `limit=${limit}`);
        if (next && !cancelled) setPage(next);
      }, 250);
    };
    const refetchIfLoaded = (id: unknown) => {
      if (typeof id === "string" && loadedRef.current.ids.has(id)) refetch();
    };

    const supabase = createClient();
    const filter = `event_id=eq.${eventId}`;
    const channel = supabase
      .channel(`chatter:${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter }, refetch)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_messages", filter }, refetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter }, refetch)
      // Deletes can't be filtered by event (only the key comes through).
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_messages" }, (p) =>
        refetchIfLoaded(p.old.id)
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (p) =>
        refetchIfLoaded(p.old.message_id)
      )
      .subscribe();

    // Fallback if the live connection drops: catch up when the app comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refetch);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refetch);
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  // "Viewed the chat" = the end of the thread is on screen.
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setAtBottom(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!atBottom || unread === 0) return;
    const newest = page.messages.at(-1)?.createdAt ?? null;
    let stale = false;
    (async () => {
      const res = await fetch(`/api/events/${eventId}/messages/read`, { method: "POST" });
      if (res.ok && !stale) setLastReadAt(newest);
    })();
    return () => {
      stale = true;
    };
  }, [atBottom, unread, eventId, page.messages]);

  async function refresh() {
    const limit = Math.max(MESSAGE_PAGE_SIZE, page.messages.length + 1);
    const next = await fetchPage(eventId, `limit=${limit}`);
    if (next) setPage(next);
  }

  async function loadEarlier() {
    const oldest = page.messages[0];
    if (!oldest) return;
    setLoadingEarlier(true);
    const older = await fetchPage(eventId, `before=${encodeURIComponent(oldest.createdAt)}`);
    setLoadingEarlier(false);
    if (older) {
      setPage((p) => ({ ...p, messages: [...older.messages, ...p.messages], hasMore: older.hasMore }));
    }
  }

  return (
    <section id="chatter" className="scroll-mt-20">
      <SectionTitle>💬 Chatter</SectionTitle>
      <div className="flex flex-col gap-3 rounded-[2rem] bg-surface p-3 ring-1 ring-line sm:p-4">
        {page.pinned.length > 0 && (
          <PinnedIdeas pinned={page.pinned} canModerate={canModerate} onChanged={refresh} />
        )}

        {page.hasMore && (
          <button
            type="button"
            onClick={loadEarlier}
            disabled={loadingEarlier}
            className="self-center rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted hover:text-foreground disabled:opacity-50"
          >
            {loadingEarlier ? "Loading…" : "↑ Show earlier messages"}
          </button>
        )}

        {page.messages.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm font-semibold text-muted">
            No messages yet — get the hype going! 🎉
          </p>
        ) : (
          <ol className="flex flex-col">
            {page.messages.map((m, i) => {
              const prev = page.messages[i - 1];
              const newDay = !prev || messageDayKey(prev.createdAt) !== messageDayKey(m.createdAt);
              const grouped =
                !newDay &&
                prev.authorId === m.authorId &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
              return (
                <li key={m.id} className={cn(grouped ? "mt-1" : "mt-3", i === 0 && "mt-0")}>
                  {newDay && (
                    <p className="mb-3 text-center text-[11px] font-extrabold tracking-wide text-muted uppercase">
                      {dayLabel(m.createdAt, today)}
                    </p>
                  )}
                  <Message
                    message={m}
                    showHeader={!grouped}
                    myName={me.name}
                    canModerate={canModerate}
                    onChanged={refresh}
                  />
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottomRef} aria-hidden className="h-px" />

        <Composer
          eventId={eventId}
          me={me}
          people={people}
          empty={page.messages.length === 0}
          gifsEnabled={gifsEnabled}
          onPosted={refresh}
        />
      </div>
    </section>
  );
}

function PinnedIdeas({
  pinned,
  canModerate,
  onChanged,
}: {
  pinned: MessageView[];
  canModerate: boolean;
  onChanged: () => void;
}) {
  async function unpin(id: string) {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: false }),
    });
    if (res.ok) onChanged();
  }
  return (
    <div className="rounded-2xl bg-amber-400/12 p-3 ring-1 ring-amber-400/40">
      <p className="text-[11px] font-extrabold tracking-wide text-amber-700 uppercase dark:text-amber-300">
        📌 Pinned ideas
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {pinned.map((m) => (
          <li key={m.id} className="flex items-start gap-2 text-sm">
            <span>💡</span>
            <p className="min-w-0 flex-1 break-words whitespace-pre-wrap">
              {m.body ? <MessageText message={m} onGradient={false} /> : "🎞️ GIF"}
              <span className="font-semibold text-muted"> — {m.authorName}</span>
            </p>
            {canModerate && (
              <button
                type="button"
                onClick={() => unpin(m.id)}
                className="shrink-0 text-xs font-bold text-muted hover:text-foreground"
              >
                Unpin
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageText({ message, onGradient }: { message: MessageView; onGradient: boolean }) {
  return (
    <>
      {splitBody(message.body, message.mentionNames).map((part, i) =>
        part.kind === "link" ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline underline-offset-2"
          >
            {part.value}
          </a>
        ) : part.kind === "mention" ? (
          <span
            key={i}
            className={cn(
              "rounded-md px-0.5 font-extrabold",
              onGradient ? "bg-white/20" : "text-violet-700 dark:text-violet-300"
            )}
          >
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

function Message({
  message: m,
  showHeader,
  myName,
  canModerate,
  onChanged,
}: {
  message: MessageView;
  showHeader: boolean;
  myName: string;
  canModerate: boolean;
  onChanged: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [showFullTime, setShowFullTime] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = m.mine || canModerate;
  const canPin = canModerate && m.isIdea;

  async function send(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/messages/${m.id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      const data = res.status < 500 ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Couldn't save that — try again.");
      return false;
    }
    setMenuOpen(false);
    onChanged();
    return true;
  }

  async function saveEdit() {
    if (await send("PATCH", { body: draft })) setEditing(false);
  }

  function remove() {
    if (window.confirm("Delete this message?")) void send("DELETE");
  }

  const linkButton = "font-bold hover:text-foreground disabled:opacity-50";

  return (
    <div className={cn("flex gap-2", m.mine && "justify-end")}>
      {!m.mine && (
        <div className="w-7 shrink-0 pt-5">
          {showHeader && <Avatar name={m.authorName} src={m.authorAvatarUrl} size="sm" />}
        </div>
      )}
      <div className={cn("flex max-w-[85%] min-w-0 flex-col gap-1", m.mine ? "items-end" : "items-start")}>
        {showHeader && !m.mine && <span className="px-1 text-xs font-bold text-muted">{m.authorName}</span>}

        {editing ? (
          <div className="flex w-72 max-w-full flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={3}
              aria-label="Edit message"
              className="w-full resize-none rounded-2xl bg-surface-2 px-3.5 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-violet-500/60"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(m.body);
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={busy || (!draft.trim() && !m.gif)}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl break-words whitespace-pre-wrap",
              m.gif ? "p-1.5" : "px-3.5 py-2",
              m.mine
                ? "rounded-tr-md bg-linear-to-br from-violet-600 to-fuchsia-500 text-white"
                : "rounded-tl-md bg-surface-2",
              m.isIdea && "ring-2 ring-amber-400/80"
            )}
          >
            {m.isIdea && (
              <span
                className={cn(
                  "mb-0.5 block text-[11px] font-extrabold tracking-wide uppercase",
                  m.mine ? "text-amber-200" : "text-amber-700 dark:text-amber-300",
                  m.gif && "px-2 pt-0.5"
                )}
              >
                💡 Idea{m.pinned && " · 📌 Pinned"}
              </span>
            )}
            {m.gif && <GifImage gif={m.gif} />}
            {m.body && (
              <div className={cn(m.gif && "px-2 pt-1.5 pb-0.5")}>
                <MessageText message={m} onGradient={m.mine} />
              </div>
            )}
          </div>
        )}

        <ReactionBar
          endpoint={`/api/messages/${m.id}/reactions`}
          label={`React to ${m.mine ? "your" : `${m.authorName}'s`} message`}
          myName={myName}
          reactions={m.reactions}
          align={m.mine ? "end" : "start"}
          hideAddWhenEmpty
          open={reactOpen}
          onOpenChange={setReactOpen}
          onSaved={onChanged}
        />

        <div className="flex flex-wrap items-center gap-x-2 px-1 text-[11px] text-muted">
          <button
            type="button"
            onClick={() => setShowFullTime((s) => !s)}
            title={fullTime(m.createdAt)}
            className="font-semibold"
          >
            <time dateTime={m.createdAt}>{showFullTime ? fullTime(m.createdAt) : clockTime(m.createdAt)}</time>
          </button>
          {m.editedAt && <span title={`Edited ${fullTime(m.editedAt)}`}>· edited</span>}
          <span aria-hidden>·</span>
          <button type="button" onClick={() => setReactOpen(!reactOpen)} className={linkButton}>
            React
          </button>
          {(m.mine || canDelete || canPin) && (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="More actions"
              className={cn(linkButton, "px-1 text-sm leading-none")}
            >
              ⋯
            </button>
          )}
        </div>

        {menuOpen && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {m.mine && !editing && (
              <MenuButton
                onClick={() => {
                  setEditing(true);
                  setMenuOpen(false);
                }}
              >
                ✏️ Edit
              </MenuButton>
            )}
            {canPin && (
              <MenuButton onClick={() => send("PATCH", { pinned: !m.pinned })} disabled={busy}>
                {m.pinned ? "📌 Unpin" : "📌 Pin idea"}
              </MenuButton>
            )}
            {canDelete && (
              <MenuButton onClick={remove} disabled={busy} danger>
                🗑️ Delete
              </MenuButton>
            )}
          </div>
        )}
        {error && <p className="px-1 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

function MenuButton({
  onClick,
  disabled,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-bold ring-1 transition active:scale-95 disabled:opacity-50",
        danger
          ? "bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400"
          : "bg-surface text-foreground ring-line hover:bg-surface-2"
      )}
    >
      {children}
    </button>
  );
}

function Composer({
  eventId,
  me,
  people,
  empty,
  gifsEnabled,
  onPosted,
}: {
  eventId: string;
  me: { id: string; name: string };
  people: Person[];
  empty: boolean;
  gifsEnabled: boolean;
  onPosted: () => void;
}) {
  const [text, setText] = useState("");
  const [isIdea, setIsIdea] = useState(false);
  const [gif, setGif] = useState<ChatGif | null>(null);
  const [pickingGif, setPickingGif] = useState(false);
  const [caret, setCaret] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // "@co" right before the caret -> suggest matching people.
  const query = text.slice(0, caret).match(/(?:^|\s)@([^\s@]{0,20})$/)?.[1] ?? null;
  const suggestions =
    query === null
      ? []
      : people
          .filter((p) => p.id !== me.id && p.name.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 5);

  function focusAt(pos: number) {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  function insertMention(person: Person) {
    const start = text.slice(0, caret).lastIndexOf("@");
    const next = `${text.slice(0, start)}@${person.name} ${text.slice(caret)}`;
    setText(next);
    focusAt(start + person.name.length + 2);
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !gif) || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isIdea, gif }),
    });
    setSending(false);
    if (!res.ok) {
      const data = res.status < 500 ? await res.json().catch(() => null) : null;
      setError(data?.error ?? "Couldn't send that — try again.");
      return;
    }
    setText("");
    setIsIdea(false);
    setGif(null);
    onPosted();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter makes a new line (phones); Ctrl/⌘+Enter sends.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {empty && !text && (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s.text}
              type="button"
              onClick={() => {
                setText(s.text);
                setIsIdea(s.idea);
                focusAt(s.text.length);
              }}
              className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted transition hover:text-foreground active:scale-95"
            >
              {s.text.trim()}
            </button>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Mention someone">
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => insertMention(p)}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/12 py-0.5 pr-3 pl-0.5 text-sm font-bold text-violet-700 dark:text-violet-300"
              >
                <Avatar name={p.name} src={p.avatarUrl} size="sm" />@{p.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Above the message box, so the phone keyboard doesn't cover the results. */}
      {pickingGif && (
        <GifPicker
          onPick={(picked) => {
            setGif(picked);
            setPickingGif(false);
          }}
          onClose={() => setPickingGif(false)}
        />
      )}
      <div
        className={cn(
          "rounded-3xl bg-surface-2 p-2",
          isIdea
            ? "ring-2 ring-amber-400/80 focus-within:ring-amber-400"
            : "ring-1 ring-line focus-within:ring-2 focus-within:ring-violet-500/60"
        )}
      >
        {gif && (
          <div className="relative m-1 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY-hosted animated image */}
            <img src={gif.url} alt={gif.title || "GIF"} className="block h-24 w-auto rounded-xl" />
            <button
              type="button"
              onClick={() => setGif(null)}
              aria-label="Remove GIF"
              className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-surface text-sm font-bold shadow-md ring-1 ring-line"
            >
              ✕
            </button>
          </div>
        )}
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={2}
          placeholder={
            gif ? "Add a message (optional)" : isIdea ? "What's your idea?" : "Say something… (@ to mention)"
          }
          aria-label="Message"
          className="w-full resize-none bg-transparent px-2 py-1.5 outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsIdea((v) => !v)}
            aria-pressed={isIdea}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 transition active:scale-95",
              isIdea
                ? "bg-amber-400/20 text-amber-800 ring-amber-400/70 dark:text-amber-200"
                : "bg-surface text-muted ring-line hover:text-foreground"
            )}
          >
            💡 {isIdea ? "Posting as an idea" : "Idea"}
          </button>
          {gifsEnabled && (
            <button
              type="button"
              onClick={() => setPickingGif((v) => !v)}
              aria-expanded={pickingGif}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 transition active:scale-95",
                pickingGif
                  ? "bg-violet-500/15 text-violet-700 ring-violet-500/60 dark:text-violet-300"
                  : "bg-surface text-muted ring-line hover:text-foreground"
              )}
            >
              🎞️ GIF
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {text.length > MAX_MESSAGE_LENGTH - 200 && (
              <span className="text-xs font-bold text-muted">{MAX_MESSAGE_LENGTH - text.length}</span>
            )}
            <Button type="submit" disabled={(!text.trim() && !gif) || sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
      {error && <p className="px-2 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
    </form>
  );
}

/** A posted GIF, sized up front so the thread doesn't jump as it loads. */
function GifImage({ gif }: { gif: ChatGif }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- GIPHY-hosted animated image
    <img
      src={gif.url}
      alt={gif.title || "GIF"}
      width={gif.width}
      height={gif.height}
      loading="lazy"
      className="block h-auto w-56 max-w-full rounded-xl bg-black/5"
      style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
    />
  );
}

/** Search GIPHY (trending until you type) and pick one to attach. */
function GifPicker({ onPick, onClose }: { onPick: (gif: ChatGif) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        const res = await fetch(`/api/gifs?q=${encodeURIComponent(query.trim())}`).catch(() => null);
        if (cancelled) return;
        if (!res?.ok) {
          setError("Couldn't load GIFs — try again.");
          setResults([]);
          return;
        }
        const data: { results: GifResult[] } = await res.json();
        if (cancelled) return;
        setError(null);
        setResults(data.results);
      },
      query ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-surface-2 p-2 ring-1 ring-line">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          aria-label="Search GIFs"
          enterKeyHint="search"
          autoFocus
          className="min-w-0 flex-1 rounded-2xl bg-surface px-3 py-2 ring-1 ring-line outline-none focus:ring-2 focus:ring-violet-500/60"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GIF search"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold text-muted ring-1 ring-line"
        >
          ✕
        </button>
      </div>
      {error ? (
        <p className="px-2 py-4 text-center text-sm font-semibold text-muted">{error}</p>
      ) : results === null ? (
        <p className="px-2 py-4 text-center text-sm font-semibold text-muted">Loading GIFs…</p>
      ) : results.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm font-semibold text-muted">No GIFs found 🤷</p>
      ) : (
        <div className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto rounded-2xl">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick({ ...r.full, title: r.title })}
              className="overflow-hidden rounded-xl bg-black/5 transition active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- GIPHY-hosted animated image */}
              <img src={r.preview.url} alt={r.title || "GIF"} loading="lazy" className="block h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="px-1 text-right text-[10px] font-extrabold tracking-wide text-muted uppercase">Powered by GIPHY</p>
    </div>
  );
}
