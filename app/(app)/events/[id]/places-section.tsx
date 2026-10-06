"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/people";
import { MAX_LINKS_PER_PASTE } from "@/lib/validations";
import { AvatarStack, Button, Chip, SectionTitle, cn, inputClasses } from "@/components/ui";
import { ResponseButtons, type Response } from "./response-controls";

export type PlaceView = {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  addedBy: string;
  /** Viewer added it, or is the organizer: may rename/remove. */
  canEdit: boolean;
  yes: number;
  maybe: number;
  no: number;
  yesPeople: Person[];
  myResponse: Response | null;
};

const LABELS = { yes: "✅ Yes", maybe: "🤔 Maybe", no: "👎 No" };

/**
 * "Where should we stay?" — hidden behind a small button until someone adds
 * the first link; then a list of preview cards the group votes on.
 */
export default function PlacesSection({
  eventId,
  places,
  chosenPlaceId,
  topPlaceId,
  isOrganizer,
}: {
  eventId: string;
  places: PlaceView[];
  chosenPlaceId: string | null;
  topPlaceId: string | null;
  isOrganizer: boolean;
}) {
  if (places.length === 0) {
    return <AddPlaces eventId={eventId} first />;
  }
  return (
    <section>
      <SectionTitle>🏠 Where should we stay?</SectionTitle>
      <div className="flex flex-col gap-3">
        {places.map((p) => (
          <PlaceCard
            key={p.id}
            eventId={eventId}
            place={p}
            chosen={p.id === chosenPlaceId}
            top={p.id === topPlaceId && p.id !== chosenPlaceId}
            isOrganizer={isOrganizer}
          />
        ))}
        <AddPlaces eventId={eventId} />
      </div>
    </section>
  );
}

/** Pulls links out of pasted text; bare "airbnb.com/rooms/1" gets https://. */
function extractUrls(text: string) {
  return text
    .split(/\s+/)
    .map((t) => t.trim().replace(/[),;]+$/, ""))
    .filter(Boolean)
    .flatMap((t) =>
      /^https?:\/\//i.test(t) ? [t] : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(t) ? [`https://${t}`] : []
    );
}

function AddPlaces({ eventId, first = false }: { eventId: string; first?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function add() {
    const urls = extractUrls(text);
    if (urls.length === 0) {
      setNotice("Paste at least one link.");
      return;
    }
    if (urls.length > MAX_LINKS_PER_PASTE) {
      setNotice(`That's a lot of links — add up to ${MAX_LINKS_PER_PASTE} at a time.`);
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/events/${eventId}/places`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "Couldn't add those links — try again.");
      return;
    }
    const problems: string[] = (body.errors ?? []).map(
      (e: { url: string; error: string }) => `${e.url} — ${e.error}`
    );
    if (body.duplicates > 0) problems.push(`${body.duplicates} already on the list`);
    setNotice(problems.length ? problems.join(" · ") : null);
    if (body.added > 0) {
      setText("");
      if (problems.length === 0) setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return first ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border-2 border-dashed border-line px-4 py-2 text-sm font-bold text-muted transition hover:border-violet-400 hover:text-violet-600"
      >
        🏠 Suggest a place to stay
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-line py-2.5 text-sm font-bold text-muted transition hover:border-violet-400 hover:text-violet-600"
      >
        + Add another link
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-1 ring-line">
      <p className="font-display text-lg font-semibold">🏠 {first ? "Where should we stay?" : "Add places"}</p>
      <p className="text-sm text-muted">
        Paste links to Airbnbs, VRBOs, hotels… One per line works too. Everyone can vote on them.
      </p>
      <textarea
        rows={3}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://www.airbnb.com/rooms/…"
        className={cn(inputClasses, "resize-none font-mono text-sm")}
      />
      {notice && (
        <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-semibold break-words text-amber-800 dark:text-amber-300">
          {notice}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={add} disabled={busy || !text.trim()}>
          {busy ? "Fetching previews…" : "Add"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PlaceCard({
  eventId,
  place: p,
  chosen,
  top,
  isOrganizer,
}: {
  eventId: string;
  place: PlaceView;
  chosen: boolean;
  top: boolean;
  isOrganizer: boolean;
}) {
  const router = useRouter();
  // Optimistic: the tap shows immediately; tallies catch up on refresh.
  const [mine, setMine] = useState<Response | null>(p.myResponse);
  const [imageFailed, setImageFailed] = useState(false);
  const [mode, setMode] = useState<"idle" | "rename" | "remove">("idle");
  const [name, setName] = useState(p.title ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(typeof body.error === "string" ? body.error : "Something went wrong — try again.");
    return res.ok;
  }

  async function vote(response: Response) {
    const previous = mine;
    setMine(response);
    if (await call(`/api/places/${p.id}/vote`, { method: "POST", body: JSON.stringify({ response }) })) {
      router.refresh();
    } else {
      setMine(previous);
    }
  }

  async function pick(placeId: string | null) {
    if (await call(`/api/events/${eventId}/place`, { method: "PUT", body: JSON.stringify({ placeId }) })) {
      router.refresh();
    }
  }

  async function rename() {
    if (await call(`/api/places/${p.id}`, { method: "PATCH", body: JSON.stringify({ title: name }) })) {
      setMode("idle");
      router.refresh();
    }
  }

  async function remove() {
    if (await call(`/api/places/${p.id}`, { method: "DELETE" })) router.refresh();
  }

  const displayTitle = p.title ?? p.siteName ?? "Link";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl bg-surface ring-1 ring-line",
        chosen && "ring-2 ring-emerald-500/70"
      )}
    >
      {p.imageUrl && !imageFailed && (
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="block h-40 w-full bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- third-party preview image; next/image would need every host allow-listed */}
          <img
            src={p.imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        </a>
      )}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {p.siteName && (
              <span className="text-[11px] font-extrabold tracking-wide text-muted uppercase">{p.siteName}</span>
            )}
            {chosen && <Chip tone="emerald">📍 We&apos;re staying here</Chip>}
            {top && <Chip tone="amber">🏆 Top pick</Chip>}
          </div>
          {mode === "rename" ? (
            <div className="mt-1 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={120}
                className={cn(inputClasses, "py-2")}
              />
              <Button onClick={rename} disabled={busy || !name.trim()}>
                Save
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
                Cancel
              </Button>
            </div>
          ) : (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-lg leading-snug font-semibold hover:underline"
            >
              {displayTitle} <span className="text-muted">↗</span>
            </a>
          )}
          {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
          <p className="mt-1 text-xs font-semibold text-muted">Added by {p.addedBy}</p>
        </div>

        <ResponseButtons value={mine} onChange={vote} labels={LABELS} disabled={busy} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AvatarStack people={p.yesPeople} />
          <span className="text-xs font-bold text-muted">
            {p.yes} yes · {p.maybe} maybe · {p.no} no
          </span>
          <span className="ml-auto flex flex-wrap gap-3 text-xs font-bold">
            {isOrganizer &&
              (chosen ? (
                <button type="button" onClick={() => pick(null)} disabled={busy} className="text-muted hover:text-foreground">
                  Un-pick
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  disabled={busy}
                  className="text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  📍 Pick this one
                </button>
              ))}
            {p.canEdit && mode === "idle" && (
              <>
                <button type="button" onClick={() => setMode("rename")} className="text-muted hover:text-foreground">
                  Rename
                </button>
                <button type="button" onClick={() => setMode("remove")} className="text-muted hover:text-rose-500">
                  Remove
                </button>
              </>
            )}
          </span>
        </div>

        {mode === "remove" && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
            <span className="font-semibold">Remove this place and its votes?</span>
            <Button variant="danger" onClick={remove} disabled={busy}>
              Remove
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              Keep it
            </Button>
          </div>
        )}
        {error && <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </article>
  );
}
