import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import AuthShell from "@/components/AuthShell";
import { buttonClasses } from "@/components/ui";
import SignupForm from "./signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("invites")
    .select("email, status, expires_at")
    .eq("token", token)
    .single();

  if (!invite || invite.status !== "pending" || new Date(invite.expires_at) < new Date()) {
    return (
      <AuthShell
        emoji="😕"
        title="Invite not valid"
        subtitle="This link was already used, has expired, or doesn't exist. Ask whoever invited you for a fresh one."
      >
        <Link href="/login" className={buttonClasses("secondary", { full: true })}>
          Go to log in
        </Link>
      </AuthShell>
    );
  }

  return <SignupForm token={token} email={invite.email} />;
}
