"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EMOJI_CHOICES, eventEmoji } from "@/lib/emoji";
import { Avatar, Button, Card, ErrorText, Field, PageTitle, cn, inputClasses } from "@/components/ui";

type Profile = { id: string; display_name: string };
type CandidateInput = { date: string; time: string };

const EMPTY_OPTION: CandidateInput = { date: "", time: "" };

export default function NewEventForm({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  // null = not picked yet, so the emoji follows the title ("BBQ" -> 🍔).
  const [pickedEmoji, setPickedEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [spousesInvited, setSpousesInvited] = useState(false);
  const [kidsAllowed, setKidsAllowed] = useState(false);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  // Each candidate is a date plus an optional time; no time = all-day option.
  const [options, setOptions] = useState<CandidateInput[]>([EMPTY_OPTION, EMPTY_OPTION]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emoji = eventEmoji(title, pickedEmoji);
  const allInvited = profiles.length > 0 && inviteeIds.length === profiles.length;

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateOption(index: number, patch: Partial<CandidateInput>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length < 5) setOptions((prev) => [...prev, EMPTY_OPTION]);
  }

  function removeOption(index: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filledOptions = options.filter((o) => o.date);
    if (filledOptions.length < 2) {
      setError("Add at least 2 dates so people have something to vote on.");
      return;
    }
    if (inviteeIds.length === 0) {
      setError("Invite at least one friend.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        emoji,
        description: description || undefined,
        location: location || undefined,
        spousesInvited,
        kidsAllowed,
        inviteeIds,
        // Date/time inputs carry no timezone; timed options are converted
        // here, in the browser's zone, so the server stores the instant the
        // user meant. All-day options send just the date.
        options: filledOptions.map((o) =>
          o.time
            ? { allDay: false, startsAt: new Date(`${o.date}T${o.time}`).toISOString() }
            : { allDay: true, date: o.date }
        ),
      }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Something went wrong.");
      return;
    }
    router.push(`/events/${body.eventId}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle sub="Propose a few dates and let the crew vote.">Plan something ✨</PageTitle>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <button
              type="button"
              aria-label="Choose an emoji"
              aria-expanded={showEmojiPicker}
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl ring-1 ring-line transition hover:scale-105 active:scale-95"
            >
              {emoji}
            </button>
            <div className="flex-1">
              <Field label="What's the plan?">
                <input
                  required
                  placeholder="Backyard BBQ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClasses}
                />
              </Field>
            </div>
          </div>
          {showEmojiPicker && (
            <div className="grid grid-cols-8 gap-1 rounded-2xl bg-surface-2 p-2">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setPickedEmoji(e);
                    setShowEmojiPicker(false);
                  }}
                  className={cn(
                    "rounded-xl py-1.5 text-2xl transition hover:scale-110",
                    e === emoji && "bg-surface ring-2 ring-violet-500"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <Field label="Where?">
            <input
              placeholder="Our place, the park, TBD…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClasses}
            />
          </Field>
          <Field label="Details">
            <textarea
              rows={3}
              placeholder="Bring a chair, potluck style, etc. (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(inputClasses, "resize-none")}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <TogglePill on={spousesInvited} onToggle={() => setSpousesInvited((v) => !v)}>
              💑 Spouses invited
            </TogglePill>
            <TogglePill on={kidsAllowed} onToggle={() => setKidsAllowed((v) => !v)}>
              🧒 Kids welcome
            </TogglePill>
          </div>
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">📅 Dates to vote on</p>
            <span className="text-xs font-bold text-muted">{options.length}/5</span>
          </div>
          <p className="mb-4 text-sm text-muted">Time is optional — leave it blank for an all-day option.</p>
          <div className="flex flex-col gap-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-500/12 text-xs font-extrabold text-violet-700 dark:text-violet-300">
                  {i + 1}
                </span>
                <input
                  type="date"
                  aria-label={`Date ${i + 1}`}
                  value={o.date}
                  onChange={(e) => updateOption(i, { date: e.target.value })}
                  className={cn(inputClasses, "min-w-0 flex-[3] px-3")}
                />
                <input
                  type="time"
                  aria-label={`Time ${i + 1} (optional)`}
                  value={o.time}
                  onChange={(e) => updateOption(i, { time: e.target.value })}
                  className={cn(inputClasses, "min-w-0 flex-[2] px-3")}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove date ${i + 1}`}
                    onClick={() => removeOption(i)}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 5 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-2.5 text-sm font-bold text-muted transition hover:border-violet-400 hover:text-violet-600"
            >
              + Add another date
            </button>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">👯 Who&apos;s invited?</p>
            {profiles.length > 1 && (
              <button
                type="button"
                onClick={() => setInviteeIds(allInvited ? [] : profiles.map((p) => p.id))}
                className="text-sm font-bold text-violet-600 dark:text-violet-300"
              >
                {allInvited ? "Clear" : "Everyone"}
              </button>
            )}
          </div>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted">No one else is in your group yet — invite some friends first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const on = inviteeIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInvitee(p.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-sm font-bold ring-1 transition active:scale-95",
                      on ? "bg-violet-600 text-white ring-violet-600" : "bg-surface-2 ring-line"
                    )}
                  >
                    <Avatar name={p.display_name} size="sm" />
                    {p.display_name}
                    {on && <span aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" size="lg" full disabled={loading}>
          {loading ? "Creating…" : `Send it ${emoji}`}
        </Button>
      </form>
    </div>
  );
}

function TogglePill({
  on,
  onToggle,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-bold ring-1 transition active:scale-95",
        on ? "bg-violet-600 text-white ring-violet-600 shadow-md shadow-violet-500/30" : "bg-surface-2 text-muted ring-line"
      )}
    >
      {children}
    </button>
  );
}
