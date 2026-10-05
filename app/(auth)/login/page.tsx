"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthShell from "@/components/AuthShell";
import { APP_NAME } from "@/lib/app";
import { Button, ErrorText, inputClasses } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Only follow same-site paths; "//evil.com" or "https://..." would be an open redirect.
    const nextParam = searchParams.get("next");
    const next =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")
        ? nextParam
        : "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <AuthShell title={APP_NAME} subtitle="Welcome back! Let's make some plans.">
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
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClasses}
        />
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit" size="lg" full disabled={loading} className="mt-1">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <Link
        href="/forgot-password"
        className="mt-4 block text-center text-sm font-bold text-violet-600 dark:text-violet-300"
      >
        Forgot your password?
      </Link>
    </AuthShell>
  );
}
