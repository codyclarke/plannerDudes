import type { createClient } from "./supabase/server";
import { AVATARS_BUCKET } from "./images";
import { signImages } from "./images.server";
import type { Person } from "./people";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Everyone in the caller's group (RLS limits profiles to it), with signed
 * avatar URLs. `get` falls back to a placeholder for unknown ids.
 */
export async function loadPeople(
  supabase: ServerClient,
  // false skips signing avatar URLs (e.g. for the offline snapshot, where
  // they'd expire before being used); avatars then fall back to initials.
  { withAvatars = true }: { withAvatars?: boolean } = {}
) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, is_owner")
    .order("display_name");
  const avatarUrls = withAvatars
    ? await signImages(AVATARS_BUCKET, (profiles ?? []).map((p) => p.avatar_path))
    : new Map<string, string>();

  const list: (Person & { isOwner: boolean })[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    avatarUrl: p.avatar_path ? (avatarUrls.get(p.avatar_path) ?? null) : null,
    isOwner: p.is_owner,
  }));
  const byId = new Map(list.map((p) => [p.id, p]));

  return {
    list,
    get(id: string): Person {
      return byId.get(id) ?? { id, name: "Someone", avatarUrl: null };
    },
  };
}
