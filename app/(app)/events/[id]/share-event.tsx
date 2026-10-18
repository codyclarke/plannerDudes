"use client";

import { useState } from "react";

/**
 * "🔗 Share": the phone's share sheet (Messages, WhatsApp, copy…) with a
 * link to this event — the installed app has no address bar to copy from.
 * Falls back to copying the link where sharing isn't supported (desktop).
 */
export default function ShareEvent({ eventId, text }: { eventId: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/events/${eventId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
      } catch {
        // Closed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button type="button" onClick={share} className="text-sm font-bold text-muted transition hover:text-foreground">
      {copied ? "✅ Link copied" : "🔗 Share"}
    </button>
  );
}
