"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { APP_NAME } from "@/lib/app";
import { Button } from "@/components/ui";

// --- Browser state (read via useSyncExternalStore) ---------------------------

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome (Android) offers its own install prompt via this event; keep it so
// "Install now" can show it later. Listening at module load catches it even
// if it fires before the button renders.
let deferredPrompt: InstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    emit();
  });
}

/** Shows Chrome's install prompt (usable once); true if they installed. */
async function showInstallPrompt() {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  emit();
  return outcome === "accepted";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const standalone = window.matchMedia("(display-mode: standalone)");
  standalone.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    standalone.removeEventListener("change", onChange);
  };
}

type Device = "hidden" | "ios" | "android";

/**
 * "hidden" in the installed app (or right after installing) and on
 * computers; otherwise the phone/tablet type, plus whether this is an
 * in-app browser (Facebook, Instagram, Google app…) that can't install.
 */
function detect(): `${Device}${"" | "-inapp"}` {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || justInstalled) return "hidden";

  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return "hidden";
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|LinkedInApp|GSA\/|; wv\)/.test(ua);
  return `${ios ? "ios" : "android"}${inApp ? "-inapp" : ""}`;
}

// --- UI ----------------------------------------------------------------------

/**
 * "📲 Install" pill for the header. Only on phones/tablets, and never inside
 * the installed app. Opens short install steps for the visitor's device.
 */
export default function InstallButton() {
  const state = useSyncExternalStore(subscribe, detect, () => "hidden" as const);
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferredPrompt, () => false);
  const [open, setOpen] = useState(false);

  if (state === "hidden") return null;
  const [device, inApp] = state.split("-") as [Exclude<Device, "hidden">, string | undefined];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-violet-500/12 px-3 py-1.5 text-sm font-extrabold text-violet-700 ring-1 ring-violet-500/30 transition active:scale-95 dark:text-violet-300"
      >
        📲 Install
      </button>
      {open && (
        <InstallSheet
          device={device}
          inApp={!!inApp}
          canPrompt={canPrompt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InstallSheet({
  device: detected,
  inApp,
  canPrompt,
  onClose,
}: {
  device: "ios" | "android";
  inApp: boolean;
  canPrompt: boolean;
  onClose: () => void;
}) {
  const [device, setDevice] = useState(detected);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function installNow() {
    setInstalling(true);
    const accepted = await showInstallPrompt();
    setInstalling(false);
    if (accepted) onClose();
  }

  // Portal: the sticky header's backdrop blur would otherwise trap this
  // fixed-position sheet inside the header.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-t-[2rem] bg-surface p-5 shadow-2xl sm:rounded-[2rem]"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="install-title" className="font-display text-2xl font-semibold">
              📲 Install {APP_NAME}
            </h2>
            <p className="text-sm font-semibold text-muted">
              {device === "ios" ? "iPhone & iPad" : "Android"} · opens like an app, with notifications
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold text-muted"
          >
            ✕
          </button>
        </div>

        {inApp && device === detected && (
          <p className="mt-4 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
            ⚠️ This app&apos;s built-in browser can&apos;t install. Tap its menu (⋯) → <b>Open in {device === "ios" ? "Safari" : "Chrome"}</b>, then
            tap 📲 Install again.
          </p>
        )}

        {device === "android" && canPrompt && !inApp && (
          <Button size="lg" full className="mt-4" onClick={installNow} disabled={installing}>
            {installing ? "Installing…" : "⬇️ Install now"}
          </Button>
        )}

        <ol className="mt-4 flex flex-col gap-2.5">
          {device === "ios" ? (
            <>
              <Step n={1}>
                Tap <b>Share</b> <ShareIcon /> <span className="text-muted">(Safari: bottom bar or ⋯ menu · Chrome: address bar)</span>
              </Step>
              <Step n={2}>
                Tap <b>Add to Home Screen</b> <span className="text-muted">(scroll down if you don&apos;t see it)</span>
              </Step>
              <Step n={3}>
                Tap <b>Add</b>, then open {APP_NAME} from your home screen
              </Step>
            </>
          ) : (
            <>
              {canPrompt && !inApp && <p className="text-xs font-bold text-muted">Or do it yourself:</p>}
              <Step n={1}>
                Tap <b>⋮</b> <span className="text-muted">(top-right in Chrome)</span>
              </Step>
              <Step n={2}>
                Tap <b>Install app</b> or <b>Add to Home screen</b> → <b>Install</b>
              </Step>
              <Step n={3}>Open {APP_NAME} from your home screen</Step>
            </>
          )}
        </ol>

        <p className="mt-4 text-sm font-semibold text-muted">
          🔔 Then turn on notifications in <b>Settings</b> (tap your picture).
        </p>

        <button
          type="button"
          onClick={() => setDevice(device === "ios" ? "android" : "ios")}
          className="mt-4 text-sm font-bold text-violet-600 dark:text-violet-300"
        >
          {device === "ios" ? "Using Android?" : "Using an iPhone or iPad?"} →
        </button>
      </div>
    </div>,
    document.body
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet-600 to-fuchsia-500 text-sm font-extrabold text-white">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/** The iOS share glyph (square with an up arrow). */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Share icon"
      className="inline size-5 -translate-y-0.5 text-sky-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
