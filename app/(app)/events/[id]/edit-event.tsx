"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatWhen } from "@/lib/format";
import { Button, Card, EmojiGrid, ErrorText, Field, TogglePill, cn, inputClasses } from "@/components/ui";

export type EditableEvent = {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  location: string | null;
  spousesInvited: boolean;
  kidsAllowed: boolean;
  /** Voting still open: candidate dates can be added/removed. */
  polling: boolean;
  options: { id: string; startsAt: string; allDay: boolean; votes: number }[];
  /** Other people who voted/RSVP'd — they're told if the event is deleted. */
  responderCount: number;
};

/** Organizer / app-owner controls: edit details, fix poll dates, delete. */
export default function EditEvent({ event }: { event: EditableEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-bold text-muted transition hover:text-foreground"
      >
        ✏️ Edit event
      </button>
    );
  }

  return (
    <Card className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-semibold">✏️ Edit event</p>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Done
        </Button>
      </div>
      <DetailsForm event={event} onSaved={() => router.refresh()} />
      {event.polling && <PollDates event={event} onChanged={() => router.refresh()} />}
      <DeleteEvent event={event} />
    </Card>
  );
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, error: typeof json.error === "string" ? json.error : "Something went wrong — try again." };
}

function DetailsForm({ event, onSaved }: { event: EditableEvent; onSaved: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [emoji, setEmoji] = useState(event.emoji);
  const [showEmoji, setShowEmoji] = useState(false);
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [partners, setPartners] = useState(event.spousesInvited);
  const [kids, setKids] = useState(event.kidsAllowed);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  // Extras that saving would clear from RSVPs ("+adults and +kids").
  const dropped = [event.spousesInvited && !partners && "+adults", event.kidsAllowed && !kids && "+kids"]
    .filter(Boolean)
    .join(" and ");
  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    setStatus("idle");
    set(v);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const res = await send(`/api/events/${event.id}`, "PATCH", {
      title,
      emoji,
      location,
      description,
      spousesInvited: partners,
      kidsAllowed: kids,
    });
    if (!res.ok) {
      setStatus("idle");
      setError(res.error);
      return;
    }
    setStatus("saved");
    onSaved();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <button
          type="button"
          aria-label="Choose an emoji"
          onClick={() => setShowEmoji((v) => !v)}
          className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl bg-surface-2 text-3xl ring-1 ring-line transition hover:scale-105"
        >
          {emoji}
        </button>
        <div className="flex-1">
          <Field label="Title">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => touch(setTitle)(e.target.value)}
              className={inputClasses}
            />
          </Field>
        </div>
      </div>
      {showEmoji && (
        <EmojiGrid
          value={emoji}
          onPick={(e) => {
            touch(setEmoji)(e);
            setShowEmoji(false);
          }}
        />
      )}
      <Field label="Where?">
        <input value={location} onChange={(e) => touch(setLocation)(e.target.value)} className={inputClasses} />
      </Field>
      <Field label="Details">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => touch(setDescription)(e.target.value)}
          className={cn(inputClasses, "resize-none")}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <TogglePill on={partners} onToggle={() => touch(setPartners)(!partners)}>
          💑 Partners invited
        </TogglePill>
        <TogglePill on={kids} onToggle={() => touch(setKids)(!kids)}>
          🧒 Kids welcome
        </TogglePill>
      </div>
      {dropped && (
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Heads up: saving clears the {dropped} people already added to their RSVPs.
        </p>
      )}
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" disabled={status === "saving" || !title.trim()} className="self-start">
        {status === "saving" ? "Saving…" : status === "saved" ? "✅ Saved" : "Save changes"}
      </Button>
    </form>
  );
}

function PollDates({ event, onChanged }: { event: EditableEvent; onChanged: () => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atMinimum = event.options.length <= 2;

  async function remove(optionId: string) {
    setBusy(true);
    setError(null);
    const res = await send(`/api/events/${event.id}/options/${optionId}`, "DELETE");
    setBusy(false);
    setConfirming(null);
    if (!res.ok) setError(res.error);
    else onChanged();
  }

  async function add() {
    setBusy(true);
    setError(null);
    // Same conversion as the create form: timed dates become an instant in
    // the browser's zone; all-day dates send just the date.
    const option = time
      ? { allDay: false, startsAt: new Date(`${date}T${time}`).toISOString() }
      : { allDay: true, date };
    const res = await send(`/api/events/${event.id}/options`, "POST", { option });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDate("");
    setTime("");
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <p className="font-bold">📅 Dates on the vote</p>
      <ul className="flex flex-col gap-2">
        {event.options.map((o) => (
          <li key={o.id} className="rounded-2xl bg-surface-2 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-semibold">{formatWhen(o.startsAt, o.allDay)}</span>
              <span className="text-xs font-bold text-muted">
                {o.votes} {o.votes === 1 ? "vote" : "votes"}
              </span>
              <button
                type="button"
                aria-label="Remove this date"
                disabled={busy || atMinimum}
                title={atMinimum ? "A vote needs at least 2 dates" : undefined}
                onClick={() => (o.votes > 0 ? setConfirming(o.id) : remove(o.id))}
                className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
            {confirming === o.id && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">
                  Remove it? The {o.votes} {o.votes === 1 ? "vote" : "votes"} on this date will be dropped.
                </span>
                <Button variant="danger" onClick={() => remove(o.id)} disabled={busy}>
                  Remove
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)} disabled={busy}>
                  Keep
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {atMinimum && <p className="text-xs text-muted">A vote needs at least 2 dates — add one before removing.</p>}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="New date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(inputClasses, "min-w-0 flex-[3] px-3")}
          />
          <input
            type="time"
            aria-label="New time (optional)"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={cn(inputClasses, "min-w-0 flex-[2] px-3")}
          />
        </div>
        <Button variant="secondary" onClick={add} disabled={!date || busy} className="self-start">
          + Add date
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function DeleteEvent({ event }: { event: EditableEvent }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await send(`/api/events/${event.id}`, "DELETE");
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const n = event.responderCount;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-5">
      {!confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)} className="self-start">
          🗑️ Delete event
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-rose-500/10 p-3">
          <p className="text-sm font-semibold">
            Delete “{event.title}” for everyone? This can&apos;t be undone.{" "}
            {n === 0
              ? "Nobody else has responded yet, so it'll just disappear."
              : `${n} ${n === 1 ? "person has" : "people have"} responded — they'll get a note that it's called off.`}
          </p>
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex gap-2">
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? "Deleting…" : "Yes, delete it"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
