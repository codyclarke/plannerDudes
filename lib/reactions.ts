// Emoji reactions on "I'm in" RSVPs — shared by the server and the browser.

/** One-tap row; anything else comes from the phone's emoji keyboard. */
export const QUICK_REACTIONS = ["🎉", "🔥", "🙌", "😂", "❤️", "🍻"];

/** Different emoji one person can leave on one RSVP (anti-spam). */
export const MAX_REACTIONS_PER_PERSON = 10;

export type ReactionView = {
  emoji: string;
  count: number;
  /** The viewer left this one (tapping the chip removes it). */
  mine: boolean;
  names: string[];
};

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Pictographs, flags (regional indicators) and keycaps like 1️⃣.
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/** Exactly one emoji — no text, no extra characters. */
export function isSingleEmoji(value: string) {
  const parts = [...graphemes.segment(value.trim())];
  return parts.length === 1 && EMOJI.test(parts[0].segment);
}

/** The last emoji typed into a text box (people may type "lol 😂"), if any. */
export function lastEmoji(value: string) {
  const parts = [...graphemes.segment(value)].map((p) => p.segment);
  return parts.reverse().find((s) => EMOJI.test(s)) ?? null;
}

/**
 * Groups reaction rows by whose RSVP they're on. Each person's chips are in
 * the order each emoji was first used, so they don't jump around.
 */
export function groupReactions(
  rows: { target_id: string; reactor_id: string; emoji: string; created_at: string }[],
  myId: string,
  nameOf: (id: string) => string
) {
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byTarget = new Map<string, ReactionView[]>();
  for (const r of sorted) {
    const list = byTarget.get(r.target_id) ?? [];
    let chip = list.find((c) => c.emoji === r.emoji);
    if (!chip) {
      chip = { emoji: r.emoji, count: 0, mine: false, names: [] };
      list.push(chip);
    }
    chip.count++;
    chip.mine ||= r.reactor_id === myId;
    chip.names.push(nameOf(r.reactor_id));
    byTarget.set(r.target_id, list);
  }
  return byTarget;
}
