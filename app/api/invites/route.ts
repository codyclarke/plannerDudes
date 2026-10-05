import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { createInviteSchema } from "@/lib/validations";
import { sendInviteEmail } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, group_id, display_name")
    .eq("id", auth.user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  const json = await request.json();
  const parsed = createInviteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const token = randomBytes(24).toString("base64url");

  // Invite insert happens via the user's own session (RLS allows group
  // members to insert invites for their own group), not the admin client.
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      group_id: profile.group_id,
      email: parsed.data.email,
      token,
      invited_by: profile.id,
    })
    .select()
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: error?.message ?? "failed to create invite" }, { status: 500 });
  }

  const inviteUrl = `${siteUrl(request)}/signup/${token}`;
  const email = await sendInviteEmail({
    to: parsed.data.email,
    inviterName: profile.display_name,
    inviteUrl,
  });

  // The invite is valid either way — if the email didn't go out, the page
  // tells the inviter to share the link themselves.
  return NextResponse.json({
    ok: true,
    inviteUrl,
    emailSent: email.sent,
    emailError: email.sent ? null : email.reason,
  });
}
