import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Cancel a pending invite (e.g. a typo'd email). Its link stops working.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS limits invites to the caller's group; the update itself goes through
  // the admin client because there's no client update policy on invites.
  const { data: invite } = await supabase.from("invites").select("id, status").eq("id", id).single();
  if (!invite) {
    return NextResponse.json({ error: "invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "this invite was already used or cancelled" }, { status: 409 });
  }

  const { error } = await createAdminClient()
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
