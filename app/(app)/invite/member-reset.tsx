"use client";

import { useState } from "react";
import { Button, cn } from "@/components/ui";
import CopyButton from "@/components/CopyButton";

/** Owner-only control on a member row: send them a password-reset link. */
export default function MemberReset({ memberId, name }: { memberId: string; name: string }) {
  const [stage, setStage] = useState<"idle" | "confirm" | "sending" | "done">("idle");
  const [result, setResult] = useState<{ resetUrl: string; emailSent: boolean; emailError: string | null } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const firstName = name.split(/\s+/)[0];

  async function send() {
    setStage("sending");
    setError(null);
    const res = await fetch(`/api/members/${memberId}/password-reset`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStage("confirm");
      setError(typeof body.error === "string" ? body.error : "Couldn't create a reset link — try again.");
      return;
    }
    setResult(body);
    setStage("done");
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStage("confirm")}
        className="text-xs font-bold text-muted transition hover:text-violet-600 dark:hover:text-violet-300"
      >
        🔑 Reset password
      </button>
    );
  }

  return (
    <div className="basis-full rounded-2xl bg-surface-2 p-3 text-sm">
      {stage !== "done" ? (
        <>
          <p className="font-semibold">
            Email {firstName} a link to choose a new password? Their current password keeps working until they do.
          </p>
          {error && <p className="mt-1 font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <Button onClick={send} disabled={stage === "sending"}>
              {stage === "sending" ? "Sending…" : "Send reset link"}
            </Button>
            <Button variant="ghost" onClick={() => setStage("idle")} disabled={stage === "sending"}>
              Never mind
            </Button>
          </div>
        </>
      ) : (
        result && (
          <>
            <p
              className={cn(
                "font-semibold",
                result.emailSent ? "text-emerald-700 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300"
              )}
            >
              {result.emailSent
                ? `✅ Reset link emailed to ${firstName}.`
                : `⚠️ The email didn't send (${result.emailError}).`}{" "}
              <span className="font-normal text-muted">
                You can also text them the link — it works once and expires in an hour.
              </span>
            </p>
            <div className="mt-2 flex gap-2">
              <CopyButton text={result.resetUrl} label="Copy reset link" />
              <Button variant="ghost" onClick={() => setStage("idle")}>
                Done
              </Button>
            </div>
          </>
        )
      )}
    </div>
  );
}
