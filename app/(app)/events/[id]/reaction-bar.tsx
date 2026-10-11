"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_REACTIONS_PER_PERSON, QUICK_REACTIONS, lastEmoji, type ReactionView } from "@/lib/reactions";
import { cn, inputClasses } from "@/components/ui";

/** The list with the viewer's `emoji` added or removed (shown before the save lands). */
function toggled(list: ReactionView[], emoji: string, add: boolean, myName: string): ReactionView[] {
  const chip = list.find((c) => c.emoji === emoji);
  if (add) {
    if (chip?.mine) return list;
    if (!chip) return [...list, { emoji, count: 1, mine: true, names: [myName] }];
    return list.map((c) => (c === chip ? { ...c, count: c.count + 1, mine: true, names: [...c.names, myName] } : c));
  }
  if (!chip?.mine) return list;
  if (chip.count === 1) return list.filter((c) => c !== chip);
  const names = [...chip.names];
  names.splice(names.lastIndexOf(myName), 1);
  return list.map((c) => (c === chip ? { ...c, count: c.count - 1, mine: false, names } : c));
}

/**
 * Emoji reactions under someone's "I'm in": tap a chip to add/remove yours,
 * or ＋ for the quick row, any emoji from the keyboard, and who reacted.
 */
export default function ReactionBar({
  eventId,
  targetId,
  targetName,
  myName,
  reactions,
}: {
  eventId: string;
  targetId: string;
  targetName: string;
  myName: string;
  reactions: ReactionView[];
}) {
  const router = useRouter();
  const [list, setList] = useState(reactions);
  // Fresh server data (after router.refresh) replaces the optimistic list.
  const [serverList, setServerList] = useState(reactions);
  if (reactions !== serverList) {
    setServerList(reactions);
    setList(reactions);
  }
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function react(emoji: string, add: boolean) {
    setError(null);
    if (add && list.filter((c) => c.mine).length >= MAX_REACTIONS_PER_PERSON) {
      setError("That's plenty of reactions 😅");
      return;
    }
    const before = list;
    setList(toggled(list, emoji, add, myName));
    const res = await fetch(`/api/events/${eventId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId, emoji, add }),
    });
    if (!res.ok) {
      setList(before);
      // 400s carry a friendly reason ("they're not going (anymore)").
      const body = res.status === 400 ? await res.json().catch(() => null) : null;
      setError(body?.error ? `Couldn't react: ${body.error}` : "Couldn't save that — try again.");
      return;
    }
    router.refresh();
  }

  const isMine = (emoji: string) => !!list.find((c) => c.emoji === emoji)?.mine;

  function pick(emoji: string) {
    setOpen(false);
    setTyped("");
    void react(emoji, !isMine(emoji));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 pl-12">
        {list.map((c) => (
          <button
            key={c.emoji}
            type="button"
            onClick={() => react(c.emoji, !c.mine)}
            title={c.names.join(", ")}
            aria-pressed={c.mine}
            aria-label={`${c.emoji} from ${c.names.join(", ")}${c.mine ? " — tap to remove yours" : ""}`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold ring-1 transition active:scale-95",
              c.mine
                ? "bg-violet-500/15 text-violet-700 ring-violet-500/60 dark:text-violet-300"
                : "bg-surface text-muted ring-line hover:text-foreground"
            )}
          >
            <span className="text-base leading-none">{c.emoji}</span>
            {c.count}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`React to ${targetName}'s RSVP`}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-sm font-extrabold ring-1 transition active:scale-95",
            open ? "bg-violet-500/15 text-violet-700 ring-violet-500/60 dark:text-violet-300" : "bg-surface text-muted ring-line hover:text-foreground"
          )}
        >
          <span className="text-base leading-none grayscale-[0.4]">😀</span>＋
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-2xl bg-surface p-2 shadow-lg ring-1 ring-line">
          <div className="flex justify-between gap-1">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                aria-pressed={isMine(e)}
                className={cn(
                  "grid size-10 place-items-center rounded-xl text-2xl transition hover:scale-110",
                  isMine(e) && "bg-violet-500/15 ring-2 ring-violet-500/60"
                )}
              >
                {e}
              </button>
            ))}
          </div>
          {/* "More": the phone's own emoji keyboard; the first emoji typed is used. */}
          <input
            value={typed}
            onChange={(ev) => {
              const emoji = lastEmoji(ev.target.value);
              if (emoji) pick(emoji);
              else setTyped(ev.target.value);
            }}
            placeholder="…or type any emoji 😜"
            aria-label="Any emoji"
            enterKeyHint="done"
            autoComplete="off"
            className={cn(inputClasses, "mt-2 py-2")}
          />
          {typed && <p className="mt-1 px-1 text-xs font-semibold text-muted">Emoji only — tap 🌐 or 😀 on your keyboard.</p>}
          {list.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 px-1 text-xs font-semibold text-muted">
              {list.map((c) => (
                <li key={c.emoji}>
                  <span className="text-sm">{c.emoji}</span> {c.names.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="mt-1 pl-12 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
