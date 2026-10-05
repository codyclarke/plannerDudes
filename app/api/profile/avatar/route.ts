import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateAvatarSchema } from "@/lib/validations";
import { AVATARS_BUCKET, isOwnImagePath } from "@/lib/images";
import { deleteImage } from "@/lib/images.server";

// Sets (or, with null, removes) the caller's profile picture.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = updateAvatarSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { avatarPath } = parsed.data;
  if (avatarPath && !isOwnImagePath(avatarPath, auth.user.id)) {
    return NextResponse.json({ error: "invalid image" }, { status: 400 });
  }

  // Users have no update policy on profiles (it would let them flip
  // is_owner), so this narrow write goes through the admin client — only
  // avatar_path, only on the caller's own row.
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("profiles")
    .select("avatar_path")
    .eq("id", auth.user.id)
    .single();
  const { error } = await admin
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (current?.avatar_path && current.avatar_path !== avatarPath) {
    await deleteImage(AVATARS_BUCKET, current.avatar_path);
  }

  return NextResponse.json({ ok: true });
}
