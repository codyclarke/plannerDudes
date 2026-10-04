import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-time route to create the first group + owner account. Guarded by
// BOOTSTRAP_SECRET; call it once, then there's no reason to call it again
// (a second call just fails because an owner already exists).
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.BOOTSTRAP_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "");

  if (!email || password.length < 8 || !displayName) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_owner", true);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if (count && count > 0) {
    return NextResponse.json({ error: "owner already exists" }, { status: 409 });
  }

  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({ name: "Friend Group" })
    .select()
    .single();
  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? "failed to create group" }, { status: 500 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    return NextResponse.json({ error: userError?.message ?? "failed to create user" }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: userData.user.id,
    group_id: group.id,
    email,
    display_name: displayName,
    is_owner: true,
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, groupId: group.id, userId: userData.user.id });
}
