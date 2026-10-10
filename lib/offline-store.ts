// Browser-only storage for the offline snapshot (see offline-snapshot.ts).
// localStorage is plenty for a few dozen events and is readable synchronously
// on the offline page; the service worker only ever serves the page shell.
import type { OfflineSnapshot } from "./offline-snapshot";

const KEY = "offline-snapshot:v1";
const MIN_REFRESH_MS = 2 * 60 * 1000;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback; // storage blocked (private mode) or full
  }
}

/** Raw JSON string (stable between calls, so it works with useSyncExternalStore). */
export function readSnapshotRaw(): string | null {
  return safe(() => localStorage.getItem(KEY), null);
}

export function parseSnapshot(raw: string | null): OfflineSnapshot | null {
  if (!raw) return null;
  return safe(() => {
    const s = JSON.parse(raw) as OfflineSnapshot;
    return s?.version === 1 ? s : null;
  }, null);
}

/** Wiped on logout so nobody else on the device sees your events. */
export function clearSnapshot() {
  safe(() => localStorage.removeItem(KEY), undefined);
}

/**
 * Fetches a fresh snapshot (when online and the last one is >2 min old) and
 * asks the service worker to refresh its cached copy of the offline page.
 */
export async function refreshSnapshot({ force = false } = {}) {
  if (!navigator.onLine) return;
  const current = parseSnapshot(readSnapshotRaw());
  if (!force && current && Date.now() - new Date(current.savedAt).getTime() < MIN_REFRESH_MS) return;

  try {
    const res = await fetch("/api/offline-snapshot", { cache: "no-store" });
    if (!res.ok) return; // signed out, server hiccup: keep whatever we had
    const snapshot = (await res.json()) as OfflineSnapshot;
    safe(() => localStorage.setItem(KEY, JSON.stringify(snapshot)), undefined);
  } catch {
    return; // went offline mid-request
  }

  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: "cache-offline-page" });
}

export function subscribeToSnapshot(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  return () => window.removeEventListener("storage", onChange);
}
