"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { Button, ErrorText, inputClasses } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  // Set when /api/auth/verify-reset bounced an expired or already-used link.
  const expired = useSearchParams().get("expired") === "1";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <AuthShell
      emoji={status === "sent" ? "📬" : "🔑"}
      title={status === "sent" ? "Check your email" : "Reset password"}
      subtitle={
        status === "sent"
          ? // Deliberately vague: doesn't reveal whether the email has an account.
            `If ${email} has an account, a reset link is on its way. It expires in an hour.`
          : "Enter your email and we'll send you a reset link."
      }
    >
      {status !== "sent" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {expired && (
            <ErrorText>That reset link expired or was already used — request a new one below.</ErrorText>
          )}
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
          {status === "error" && <ErrorText>Something went wrong. Try again.</ErrorText>}
          <Button type="submit" size="lg" full disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link
        href="/login"
        className="mt-4 block text-center text-sm font-bold text-violet-600 dark:text-violet-300"
      >
        ← Back to log in
      </Link>
    </AuthShell>
  );
}
