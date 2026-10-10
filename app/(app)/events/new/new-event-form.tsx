"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eventEmoji } from "@/lib/emoji";
import { MAX_DATE_OPTIONS } from "@/lib/validations";
import { endOfDayIso } from "@/lib/voting-deadline";
import { COVER_IMAGE, discardImage, uploadImage } from "@/lib/upload-image";
import { EVENT_IMAGES_BUCKET } from "@/lib/images";
import { Button, Card, ErrorText, Field, PageTitle, cn, inputClasses, EmojiGrid, TogglePill } from "@/components/ui";
import CoverPicker from "@/components/CoverPicker";

type CandidateInput = { date: string; time: string };

const EMPTY_OPTION: CandidateInput = { date: "", time: "" };

export default function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  // null = not picked yet, so the emoji follows the title ("BBQ" -> 🍔).
  const [pickedEmoji, setPickedEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [spousesInvited, setSpousesInvited] = useState(false);
  const [kidsAllowed, setKidsAllowed] = useState(false);
  // Each candidate is a date plus an optional time; no time = all-day option.
  const [options, setOptions] = useState<CandidateInput[]>([EMPTY_OPTION, EMPTY_OPTION]);
  // Optional "YYYY-MM-DD"; voting closes at the end of that day.
  const [closesOn, setClosesOn] = useState("");
  // "vote": friends vote on 2+ candidate dates. "set": the date is already
  // decided (birthday, festival) — created locked in, friends just RSVP.
  const [mode, setMode] = useState<"vote" | "set">("vote");
  const isSetDate = mode === "set";
  const [cover, setCover] = useState<{ path: string; previewUrl: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emoji = eventEmoji(title, pickedEmoji);

  // Photos upload as soon as they're picked; one that gets replaced or
  // removed before the event is created is deleted again.
  async function pickCover(file: File) {
    setError(null);
    setCoverBusy(true);
    try {
      const uploaded = await uploadImage(EVENT_IMAGES_BUCKET, file, COVER_IMAGE);
      if (cover) discardImage(EVENT_IMAGES_BUCKET, cover.path);
      setCover(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setCoverBusy(false);
    }
  }

  function removeCover() {
    if (cover) discardImage(EVENT_IMAGES_BUCKET, cover.path);
    setCover(null);
  }

  function updateOption(index: number, patch: Partial<CandidateInput>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length < MAX_DATE_OPTIONS) setOptions((prev) => [...prev, EMPTY_OPTION]);
  }

  function removeOption(index: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // A set-date event uses just the first row.
    const filledOptions = (isSetDate ? options.slice(0, 1) : options).filter((o) => o.date);
    const todayKey = new Date().toLocaleDateString("en-CA"); // local "YYYY-MM-DD"
    if (isSetDate) {
      if (filledOptions.length === 0) {
        setError("Pick the date.");
        return;
      }
      if (filledOptions[0].date < todayKey) {
        setError("That date has already passed.");
        return;
      }
    } else if (filledOptions.length < 2) {
      setError("Add at least 2 dates so people have something to vote on.");
      return;
    }
    if (!isSetDate && closesOn) {
      const firstDate = filledOptions.map((o) => o.date).sort()[0];
      if (closesOn < todayKey) {
        setError("The voting closing date can't be in the past.");
        return;
      }
      if (closesOn > firstDate) {
        setError("Voting should close on or before the first proposed date.");
        return;
      }
    }

    setLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        emoji,
        imagePath: cover?.path,
        description: description || undefined,
        location: location || undefined,
        spousesInvited,
        kidsAllowed,
        fixedDate: isSetDate,
        votingClosesAt: !isSetDate && closesOn ? endOfDayIso(closesOn) : undefined,
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
        <CoverPicker
          imageUrl={cover?.previewUrl ?? null}
          busy={coverBusy}
          onPick={pickCover}
          onRemove={removeCover}
        />
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
            <EmojiGrid
              value={emoji}
              onPick={(e) => {
                setPickedEmoji(e);
                setShowEmojiPicker(false);
              }}
            />
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
              💑 Partners invited
            </TogglePill>
            <TogglePill on={kidsAllowed} onToggle={() => setKidsAllowed((v) => !v)}>
              🧒 Kids welcome
            </TogglePill>
          </div>
        </Card>

        <Card>
          <div role="radiogroup" aria-label="How is the date decided?" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
            {(
              [
                ["vote", "🗳️ Vote on dates"],
                ["set", "📅 Set date"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "rounded-xl py-2 text-sm font-extrabold transition",
                  mode === value ? "bg-violet-600 text-white shadow-md shadow-violet-500/30" : "text-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-1 flex items-center justify-between">
            <p className="font-display text-lg font-semibold">
              {isSetDate ? "📅 When is it?" : "📅 Dates to vote on"}
            </p>
            {!isSetDate && (
              <span className="text-xs font-bold text-muted">
                {options.length}/{MAX_DATE_OPTIONS}
              </span>
            )}
          </div>
          <p className="mb-4 text-sm text-muted">
            {isSetDate
              ? "Everyone can RSVP right away. Time is optional — leave it blank for an all-day event."
              : "Time is optional — leave it blank for an all-day option."}
          </p>
          <div className="flex flex-col gap-2">
            {(isSetDate ? options.slice(0, 1) : options).map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                {!isSetDate && (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-500/12 text-xs font-extrabold text-violet-700 dark:text-violet-300">
                    {i + 1}
                  </span>
                )}
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
                {!isSetDate && options.length > 2 && (
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
          {!isSetDate && options.length < MAX_DATE_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-3 w-full rounded-2xl border-2 border-dashed border-line py-2.5 text-sm font-bold text-muted transition hover:border-violet-400 hover:text-violet-600"
            >
              + Add another date
            </button>
          )}

          {!isSetDate && (
            <div className="mt-5 border-t border-line pt-4">
              <Field
                label="⏳ Voting closes (optional)"
                hint="Anyone who hasn't voted gets a push nudge 3 days before, the day before, and the morning it closes."
              >
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={closesOn}
                    onChange={(e) => setClosesOn(e.target.value)}
                    className={cn(inputClasses, "min-w-0 flex-1 px-3")}
                  />
                  {closesOn && (
                    <button
                      type="button"
                      aria-label="Remove closing date"
                      onClick={() => setClosesOn("")}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </Field>
            </div>
          )}
        </Card>

        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" size="lg" full disabled={loading || coverBusy}>
          {loading ? "Creating…" : `Send it ${emoji}`}
        </Button>
      </form>
    </div>
  );
}
