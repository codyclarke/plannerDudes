"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function SettingsPage() {
  const [status, setStatus] = useState<"unknown" | "subscribed" | "unsubscribed" | "unsupported">(
    "unknown"
  );
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
        setError("Notification permission was denied.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const raw = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
      });
      setStatus("subscribed");
    } catch {
      setError("Could not enable push notifications on this device.");
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

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div>
        <h2 className="font-medium">Push notifications</h2>
        <p className="text-sm text-neutral-500">
          Get notified when a new event is proposed, a time is finalized, or an event is coming up.
        </p>
        {status === "unsupported" && (
          <p className="mt-2 text-sm text-neutral-500">Not supported on this browser.</p>
        )}
        {status === "unsubscribed" && (
          <button
            onClick={enablePush}
            className="mt-2 rounded bg-black px-3 py-2 text-sm text-white"
          >
            Enable push notifications
          </button>
        )}
        {status === "subscribed" && (
          <button onClick={disablePush} className="mt-2 rounded border px-3 py-2 text-sm">
            Disable push notifications
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
