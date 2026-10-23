import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateNameSchema } from "@/lib/validations";

// Changes the caller's display name (what the group sees). Login email and
// password are untouched.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = updateNameSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid name.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { displayName } = parsed.data;

  // Names must be unique in the group (case-insensitive) so @mentions and
  // "who's coming" lists stay unambiguous. RLS limits this to the group.
  const { data: members } = await supabase.from("profiles").select("id, display_name");
  const taken = (members ?? []).some(
    (m) => m.id !== auth.user!.id && m.display_name.trim().toLowerCase() === displayName.toLowerCase()
  );
  if (taken) {
    return NextResponse.json({ error: `Someone in the group is already called “${displayName}”.` }, { status: 409 });
  }

  // Users have no update policy on profiles (it would let them flip
  // is_owner), so this narrow write goes through the admin client — only
  // display_name, only on the caller's own row.
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, displayName });
}
