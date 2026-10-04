import { createAdminClient } from "@/lib/supabase/admin";
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
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">Invite not valid</h1>
        <p>This invite link has already been used, expired, or doesn&apos;t exist.</p>
      </div>
    );
  }

  return <SignupForm token={token} email={invite.email} />;
}
