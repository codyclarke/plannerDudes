import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { buttonClasses } from "@/components/ui";

// Landing page for password-reset links. The token is only spent when the
// person presses Continue (a POST): email security scanners open GET links
// automatically and would otherwise burn the one-time token.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;

  if (!token_hash) {
    return (
      <AuthShell emoji="😕" title="Link not valid" subtitle="This reset link is incomplete. Request a new one.">
        <Link href="/forgot-password" className={buttonClasses("secondary", { full: true })}>
          Get a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell emoji="🔑" title="Reset your password" subtitle="Tap continue to choose a new password.">
      <form method="post" action="/api/auth/verify-reset">
        <input type="hidden" name="token_hash" value={token_hash} />
        <button type="submit" className={buttonClasses("primary", { size: "lg", full: true })}>
          Continue
        </button>
      </form>
    </AuthShell>
  );
}
