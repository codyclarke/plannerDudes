import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPasswordReset } from "@/lib/password-reset.server";

// Owner-only: email a member a password-reset link, and hand the link back so
// the owner can text it if the email doesn't arrive.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("is_owner, display_name")
    .eq("id", auth.user.id)
    .single();
  if (!me?.is_owner) {
    return NextResponse.json({ error: "only the owner can reset someone's password" }, { status: 403 });
  }

  // RLS limits profiles to the caller's group, so another group's member
  // simply isn't found.
  const { data: member } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", memberId)
    .single();
  if (!member) {
    return NextResponse.json({ error: "member not found" }, { status: 404 });
  }

  const result = await sendPasswordReset(request, member, me.display_name);
  if (!result) {
    return NextResponse.json({ error: "couldn't create a reset link" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    resetUrl: result.resetUrl,
    emailSent: result.email.sent,
    emailError: result.email.sent ? null : result.email.reason,
  });
}
