import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deliverInvite } from "@/lib/invites.server";

const THROTTLE_MS = 60 * 1000;

// Resend a pending invite's email (same link) and restart its 14-day clock.
// Any group member can do this, same as creating invites.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", auth.user.id)
    .single();

  // RLS limits invites to the caller's group.
  const { data: invite } = await supabase
    .from("invites")
    .select("id, email, token, status, last_sent_at")
    .eq("id", id)
    .single();
  if (!invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "this invite was already used or cancelled" }, { status: 409 });
  }
  if (Date.now() - new Date(invite.last_sent_at).getTime() < THROTTLE_MS) {
    return NextResponse.json({ error: "Just sent — give it a minute before resending." }, { status: 429 });
  }

  const { inviteUrl, email } = await deliverInvite(request, invite, me?.display_name ?? "A friend");
  return NextResponse.json({
    ok: true,
    inviteUrl,
    emailSent: email.sent,
    emailError: email.sent ? null : email.reason,
  });
}
