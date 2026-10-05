"use client";

import { useState } from "react";
import { Button, Card, ErrorText, cn, inputClasses } from "@/components/ui";

export default function InviteForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  // null when the email went out; otherwise why it didn't.
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    setCopied(false);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(true);
      return;
    }
    setSentTo(email);
    setInviteUrl(body.inviteUrl);
    setEmailError(body.emailSent ? null : (body.emailError ?? "The email couldn't be sent."));
    setEmail("");
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // Clipboard can be unavailable (e.g. insecure context); the link is
      // still shown for manual copying.
    }
  }

  return (
    <Card>
      <p className="font-display text-lg font-semibold">💌 Invite a friend</p>
      <p className="mb-4 text-sm text-muted">They&apos;ll get an email with a link to join.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="friend@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
        />
        <Button type="submit" disabled={loading} className="shrink-0">
          {loading ? "Sending…" : "Send invite"}
        </Button>
      </form>

      {error && (
        <div className="mt-3">
          <ErrorText>Couldn&apos;t create that invite — try again.</ErrorText>
        </div>
      )}

      {sentTo && inviteUrl && (
        <div className={cn("mt-4 rounded-2xl p-4", emailError ? "bg-amber-400/15" : "bg-emerald-500/10")}>
          {emailError ? (
            <>
              <p className="font-bold text-amber-700 dark:text-amber-300">
                ⚠️ Invite created, but the email to {sentTo} didn&apos;t send
              </p>
              <p className="mt-1 text-sm text-muted">{emailError}</p>
              <p className="mt-1 text-sm font-semibold">Text or message them this link instead:</p>
            </>
          ) : (
            <>
              <p className="font-bold text-emerald-700 dark:text-emerald-300">🎉 Invite emailed to {sentTo}</p>
              <p className="mt-1 text-sm text-muted">You can also send them the link directly:</p>
            </>
          )}
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3 py-2 text-xs">{inviteUrl}</code>
            <Button type="button" variant="secondary" onClick={copyLink} className="shrink-0">
              {copied ? "Copied ✓" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
