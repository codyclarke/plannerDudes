"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Profile = { id: string; display_name: string };

export default function NewEventForm({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [spousesInvited, setSpousesInvited] = useState(false);
  const [kidsAllowed, setKidsAllowed] = useState(false);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addOption() {
    if (options.length < 5) setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length > 2) setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filledOptions = options.filter((o) => o.trim().length > 0);
    if (filledOptions.length < 2) {
      setError("Add at least 2 candidate times.");
      return;
    }
    if (inviteeIds.length === 0) {
      setError("Invite at least one person.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        location: location || undefined,
        spousesInvited,
        kidsAllowed,
        inviteeIds,
        // datetime-local values carry no timezone; convert here, in the
        // browser's zone, so the server stores the instant the user meant.
        options: filledOptions.map((value) => ({ startsAt: new Date(value).toISOString() })),
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
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold">New event</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          placeholder="Location (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded border px-3 py-2"
        />

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={spousesInvited}
              onChange={(e) => setSpousesInvited(e.target.checked)}
            />
            Spouses invited
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={kidsAllowed}
              onChange={(e) => setKidsAllowed(e.target.checked)}
            />
            Kids allowed
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Invite</legend>
          {profiles.length === 0 && (
            <p className="text-sm text-neutral-500">No one else in your group yet.</p>
          )}
          {profiles.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inviteeIds.includes(p.id)}
                onChange={() => toggleInvitee(p.id)}
              />
              {p.display_name}
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Candidate times (2-5)</legend>
          {options.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={value}
                onChange={(e) => updateOption(i, e.target.value)}
                className="rounded border px-3 py-2"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="text-sm text-neutral-500 underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button
              type="button"
              onClick={addOption}
              className="self-start text-sm text-blue-600 underline"
            >
              + Add another time
            </button>
          )}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create event"}
        </button>
      </form>
    </div>
  );
}
