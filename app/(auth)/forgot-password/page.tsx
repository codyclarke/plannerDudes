"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import { Button, ErrorText, inputClasses } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
    });
    setLoading(false);
    setStatus(error ? "error" : "sent");
  }

  return (
    <AuthShell
      emoji={status === "sent" ? "📬" : "🔑"}
      title={status === "sent" ? "Check your email" : "Reset password"}
      subtitle={
        status === "sent"
          ? `We sent a reset link to ${email}.`
          : "Enter your email and we'll send you a reset link."
      }
    >
      {status !== "sent" && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
