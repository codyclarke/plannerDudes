"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushToggle() {
  const [status, setStatus] = useState<"unknown" | "subscribed" | "unsubscribed" | "unsupported">(
    "unknown"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (active) setStatus("unsupported");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (active) setStatus(sub ? "subscribed" : "unsubscribed");
    })();
    return () => {
      active = false;
    };
  }, []);

  async function enablePush() {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications are blocked — allow them in your browser settings.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });
      const raw = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
      });
      setStatus("subscribed");
    } catch {
      setError("Couldn't turn on notifications on this device.");
    }
  }

  async function disablePush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }

  async function toggle() {
    setBusy(true);
    await (status === "subscribed" ? disablePush() : enablePush());
    setBusy(false);
  }

  const on = status === "subscribed";

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="font-bold">🔔 Push notifications</p>
          <p className="text-sm text-muted">
            {status === "unsupported"
              ? "Not supported in this browser. On iPhone, add the app to your Home Screen first."
              : "New events, locked-in dates, and day-before reminders."}
          </p>
        </div>
        {status !== "unsupported" && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Push notifications"
            disabled={busy || status === "unknown"}
            onClick={toggle}
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50",
              on ? "bg-linear-to-r from-violet-600 to-fuchsia-500" : "bg-surface-2 ring-1 ring-line"
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform",
                on && "translate-x-6"
              )}
            />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
