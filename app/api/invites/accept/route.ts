import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { token, displayName, password } = parsed.data;

  const admin = createAdminClient();

  // Claim the invite atomically: only one request can flip it from pending,
  // so two clicks on the same link can't both create accounts.
  const { data: invite } = await admin
    .from("invites")
    .update({ status: "accepted" })
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();

  if (!invite) {
    return NextResponse.json(
      { error: "This invite is invalid, expired, or already used." },
      { status: 404 }
    );
  }

  const releaseInvite = () =>
    admin.from("invites").update({ status: "pending" }).eq("id", invite.id);

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    await releaseInvite();
    return NextResponse.json(
      { error: userError?.message ?? "failed to create account" },
      { status: 500 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    group_id: invite.group_id,
    email: invite.email,
    display_name: displayName,
  });
  if (profileError) {
    // Without this, the orphaned login would block the friend from retrying
    // ("email already registered").
    await admin.auth.admin.deleteUser(userData.user.id);
    await releaseInvite();
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await admin.from("invites").update({ accepted_by: userData.user.id }).eq("id", invite.id);

  return NextResponse.json({ ok: true, email: invite.email });
}
