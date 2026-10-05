import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInviteSchema } from "@/lib/validations";
import { deliverInvite } from "@/lib/invites.server";

// Case-insensitive exact match for ilike: escape its % and _ wildcards.
const ilikeExact = (s: string) => s.replace(/[\\%_]/g, "\\$&");

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
  const email = parsed.data.email;

  const { data: existingMember } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", ilikeExact(email))
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json({ error: `${email} is already in the crew.` }, { status: 409 });
  }

  // Re-inviting someone with a pending invite resends that invite (same link)
  // instead of piling up duplicates.
  const { data: pending } = await supabase
    .from("invites")
    .select("id, email, token")
    .eq("status", "pending")
    .ilike("email", ilikeExact(email))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invite = pending;
  if (!invite) {
    // Inserted via the user's own session (RLS lets group members create
    // invites for their own group), not the admin client.
    const { data: created, error } = await supabase
      .from("invites")
      .insert({
        group_id: profile.group_id,
        email,
        token: randomBytes(24).toString("base64url"),
        invited_by: profile.id,
      })
      .select("id, email, token")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "failed to create invite" }, { status: 500 });
    }
    invite = created;
  }

  const { inviteUrl, email: emailResult } = await deliverInvite(request, invite, profile.display_name);

  // The invite is valid either way — if the email didn't go out, the page
  // tells the inviter to share the link themselves.
  return NextResponse.json({
    ok: true,
    inviteUrl,
    resent: !!pending,
    emailSent: emailResult.sent,
    emailError: emailResult.sent ? null : emailResult.reason,
  });
}
