"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import { Button, ErrorText, Field, inputClasses } from "@/components/ui";

export default function SignupForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, displayName, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(typeof body.error === "string" ? body.error : "Something went wrong.");
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      emoji="🥳"
      title="You're invited!"
      subtitle={
        <>
          Set up your account for <strong className="text-foreground">{email}</strong>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Your name" hint="This is what your friends will see.">
          <input
            required
            autoComplete="name"
            placeholder="Alex"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="8+ characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" size="lg" full disabled={loading} className="mt-1">
          {loading ? "Creating account…" : "Join the crew 🎉"}
        </Button>
      </form>
    </AuthShell>
  );
}
