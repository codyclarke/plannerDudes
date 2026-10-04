import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
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

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/signup/${token}`;
  await sendInviteEmail({
    to: parsed.data.email,
    inviterName: profile.display_name,
    inviteUrl,
  });

  return NextResponse.json({ ok: true, inviteUrl });
}
