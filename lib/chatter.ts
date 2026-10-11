// "Chatter" — the conversation on each event. Shared by the server and the
// browser (types, @mentions, text splitting, timestamps).
import { APP_TIMEZONE, dateKeyInAppZone } from "./format";
import type { ReactionView } from "./reactions";

export const MAX_MESSAGE_LENGTH = 1000;
/** Messages loaded at a time ("Show earlier" loads another page). */
export const MESSAGE_PAGE_SIZE = 30;

export type MessageView = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  isIdea: boolean;
  pinned: boolean;
  /** Names that were @mentioned (highlighted in the text). */
  mentionNames: string[];
  reactions: ReactionView[];
  /** The viewer wrote it (can edit/delete). */
  mine: boolean;
};

export type ChatterPage = {
  messages: MessageView[];
  /** Pinned ideas, shown above the thread (may be older than the loaded page). */
  pinned: MessageView[];
  hasMore: boolean;
  total: number;
};

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Group members @mentioned in `body` ("@Cody", "@cody clarke"). Longest
 * names win, so "@Cody Clarke" doesn't also count as "@Cody".
 */
export function findMentions(body: string, people: { id: string; name: string }[]) {
  const sorted = [...people].filter((p) => p.name.trim()).sort((a, b) => b.name.length - a.name.length);
  const lower = body.toLowerCase();
  const found = new Set<string>();
  for (let i = lower.indexOf("@"); i !== -1; i = lower.indexOf("@", i + 1)) {
    if (i > 0 && LETTER_OR_DIGIT.test(lower.charAt(i - 1))) continue; // e.g. an email address
    const rest = lower.slice(i + 1);
    const person = sorted.find((p) => {
      const name = p.name.toLowerCase();
      return rest.startsWith(name) && !LETTER_OR_DIGIT.test(rest.charAt(name.length));
    });
    if (person) found.add(person.id);
  }
  return [...found];
}

export type BodyPart = { kind: "text" | "link" | "mention"; value: string };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A URL, minus trailing punctuation ("see https://x.com." -> "https://x.com").
const URL_SOURCE = String.raw`https?:\/\/[^\s<]*[^\s<.,:;"')\]!?]`;

/** Splits a message into plain text, links and @mentions for rendering. */
export function splitBody(body: string, mentionNames: string[]): BodyPart[] {
  const names = [...mentionNames].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const mention = names.length ? `|(?<![\\p{L}\\p{N}])@(?:${names.join("|")})(?![\\p{L}\\p{N}])` : "";
  const pattern = new RegExp(`(${URL_SOURCE}${mention})`, "giu");
  const parts: BodyPart[] = [];
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", value: body.slice(last, start) });
    parts.push({ kind: match[0].startsWith("@") ? "mention" : "link", value: match[0] });
    last = start + match[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", value: body.slice(last) });
  return parts;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});
const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const fullFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/** "Today" / "Yesterday" / "Sat, Oct 10", for the group's timezone. */
export type Today = { today: string; yesterday: string };

/** Reads the clock — call it outside render (or once per render pass). */
export function todayKeys(now = new Date()): Today {
  return {
    today: dateKeyInAppZone(now),
    yesterday: dateKeyInAppZone(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  };
}

export const messageDayKey = (iso: string) => dateKeyInAppZone(new Date(iso));

export function dayLabel(iso: string, { today, yesterday }: Today) {
  const key = messageDayKey(iso);
  return key === today ? "Today" : key === yesterday ? "Yesterday" : dayFormatter.format(new Date(iso));
}

/** "2:15 PM" (the thread's day dividers carry the date). */
export const clockTime = (iso: string) => timeFormatter.format(new Date(iso));

/** "2:15 PM" today, otherwise "Sat, Oct 10 · 2:15 PM". */
export function messageTime(iso: string, { today }: Today) {
  const time = timeFormatter.format(new Date(iso));
  return messageDayKey(iso) === today ? time : `${dayFormatter.format(new Date(iso))} · ${time}`;
}

/** "Saturday, October 10, 2026 at 2:15 PM PDT" (tooltip / tap). */
export const fullTime = (iso: string) => fullFormatter.format(new Date(iso));
