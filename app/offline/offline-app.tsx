"use client";

import { useMemo, useSyncExternalStore } from "react";
import { APP_NAME } from "@/lib/app";
import { APP_TIMEZONE } from "@/lib/format";
import { parseSnapshot, readSnapshotRaw, subscribeToSnapshot } from "@/lib/offline-store";
import type { OfflineSnapshot } from "@/lib/offline-snapshot";
import { describeDeadline } from "@/lib/voting-deadline";
import DashboardView from "@/app/(app)/dashboard/dashboard-view";
import { Button, Card } from "@/components/ui";
import OfflineEventView from "./offline-event-view";

// --- Browser state, read via useSyncExternalStore (no effects needed) -------

function subscribeLocation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}
const locationKey = () => `${window.location.pathname}${window.location.hash}`;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Which event to show. "#event=<id>" (cards link here) or "#list" are set
 * by this page; with no hash, use the URL the person was trying to open —
 * the service worker shows this page in place of e.g. /events/<id>.
 */
function selectedEventId(key: string) {
  const [path, hash = ""] = key.split("#");
  if (hash.startsWith("event=")) return decodeURIComponent(hash.slice(6));
  if (hash === "list") return null;
  return path.match(/^\/events\/([0-9a-f-]{36})$/)?.[1] ?? null;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "Sat 2:15 PM · 3 hours ago". Reads the clock, so it lives outside components. */
function savedText(savedAt: string) {
  const minutes = Math.round((Date.now() - new Date(savedAt).getTime()) / 60000);
  const ago =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : minutes < 60 * 24
          ? `${Math.round(minutes / 60)} hr ago`
          : `${Math.round(minutes / (60 * 24))} days ago`;
  return `${timeFormatter.format(new Date(savedAt))} · ${ago}`;
}

/**
 * Dashboard cards with voting countdowns recomputed for right now — the saved
 * ones were worked out when the snapshot was taken. (Reads the clock.)
 */
function currentCards(snapshot: OfflineSnapshot) {
  const now = new Date();
  return snapshot.dashboard.map((card) =>
    card.status === "polling"
      ? { ...card, deadline: describeDeadline(snapshot.events[card.id]?.votingClosesAt ?? null, now) }
      : card
  );
}

/** Read-only app shown when there's no connection. */
export default function OfflineApp() {
  const raw = useSyncExternalStore(subscribeToSnapshot, readSnapshotRaw, () => null);
  const snapshot = useMemo(() => parseSnapshot(raw), [raw]);
  const location = useSyncExternalStore(subscribeLocation, locationKey, () => "/offline");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => false);

  const eventId = selectedEventId(location);
  const event = eventId ? snapshot?.events[eventId] : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-lg">
              <span className="pergola:hidden">🎉</span>
              <span className="hidden pergola:inline">🪵</span>
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              <span className="pergola:hidden">{APP_NAME}</span>
              <span className="hidden pergola:inline">Pergola Planner</span>
            </span>
          </span>
          {online ? (
            // Back online: a full reload goes to the live app (to the page
            // they were trying to open, if any).
            <Button onClick={() => window.location.reload()}>📶 Back online — reload</Button>
          ) : (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold text-muted">📴 Offline</span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-12">
        {!snapshot ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-5xl">📴</span>
            <p className="font-display text-xl font-semibold">You&apos;re offline</p>
            <p className="text-muted">
              Nothing has been saved on this device yet. Open the app once with a connection and your upcoming
              events will be available here offline.
            </p>
          </Card>
        ) : (
          <>
            <p className="rounded-2xl bg-amber-400/15 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
              📴 {online ? "Showing" : "You're offline — showing"} what was saved {savedText(snapshot.savedAt)}.
              Voting and RSVPs need a connection.
            </p>
            {event ? (
              <OfflineEventView event={event} />
            ) : eventId ? (
              <Card className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-4xl">🕵️</span>
                <p className="font-bold">That event isn&apos;t saved on this device.</p>
                <a href="#list" className="text-sm font-bold text-violet-600 dark:text-violet-300">
                  ← See saved events
                </a>
              </Card>
            ) : snapshot.dashboard.length === 0 ? (
              <Card className="py-8 text-center text-muted">No upcoming events were saved.</Card>
            ) : (
              <DashboardView
                name={snapshot.myName}
                events={currentCards(snapshot)}
                eventHref={(id) => `#event=${encodeURIComponent(id)}`}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
