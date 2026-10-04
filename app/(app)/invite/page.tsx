"use client";

import { useState } from "react";

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setStatus("error");
      return;
    }
    setStatus("sent");
    setInviteUrl(body.inviteUrl);
    setEmail("");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold">Invite a friend</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Their email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send invite"}
        </button>
      </form>
      {status === "sent" && inviteUrl && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm">
          <p>Invite sent. If email isn&apos;t configured yet, share this link directly:</p>
          <p className="mt-1 break-all font-mono text-xs">{inviteUrl}</p>
        </div>
      )}
      {status === "error" && <p className="text-sm text-red-600">Something went wrong.</p>}
    </div>
  );
}
