"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, cn } from "@/components/ui";
import CopyButton from "@/components/CopyButton";

export type PendingInvite = {
  id: string;
  email: string;
  signupPath: string; // "/signup/<token>"
  invitedBy: string;
  sentText: string; // e.g. "sent 2 days ago"
  expiresText: string; // e.g. "expires in 12 days" / "expired"
  expired: boolean;
};

export default function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  return (
    <Card className="p-2">
      <ul className="divide-y divide-line">
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} />
        ))}
      </ul>
    </Card>
  );
}

function InviteRow({ invite }: { invite: PendingInvite }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  async function resend() {
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/invites/${invite.id}/resend`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice({ tone: "warn", text: typeof body.error === "string" ? body.error : "Couldn't resend — try again." });
      return;
    }
    setNotice(
      body.emailSent
        ? { tone: "ok", text: "Invite re-sent ✓" }
        : { tone: "warn", text: `The email didn't send (${body.emailError}) — copy the link and text it instead.` }
    );
    router.refresh();
  }

  async function cancel() {
    setBusy(true);
    const res = await fetch(`/api/invites/${invite.id}/cancel`, { method: "POST" });
    setBusy(false);
    setConfirmingCancel(false);
    if (!res.ok) {
      setNotice({ tone: "warn", text: "Couldn't cancel — try again." });
      return;
    }
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-lg">💌</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{invite.email}</p>
          <p className="text-xs font-semibold text-muted">
            Invited by {invite.invitedBy} · {invite.sentText}
          </p>
        </div>
        <Chip tone={invite.expired ? "rose" : "amber"}>{invite.expiresText}</Chip>
      </div>

      {confirmingCancel ? (
        <div className="flex flex-wrap items-center gap-2 sm:pl-12">
          <span className="text-sm font-semibold">Cancel this invite? The link will stop working.</span>
          <Button variant="danger" onClick={cancel} disabled={busy}>
            Yes, cancel
          </Button>
          <Button variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={busy}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 sm:pl-12">
          <CopyButton text={() => `${window.location.origin}${invite.signupPath}`} label="Copy link" />
          <Button variant="secondary" onClick={resend} disabled={busy}>
            {busy ? "Sending…" : invite.expired ? "Resend (renews it)" : "Resend email"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmingCancel(true)} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}

      {notice && (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-semibold sm:ml-12",
            notice.tone === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-400/15 text-amber-800 dark:text-amber-300"
          )}
        >
          {notice.text}
        </p>
      )}
    </li>
  );
}
