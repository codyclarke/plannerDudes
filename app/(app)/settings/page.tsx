import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET } from "@/lib/images";
import { signImages } from "@/lib/images.server";
import { Card, PageTitle } from "@/components/ui";
import LogoutButton from "@/components/LogoutButton";
import AvatarEditor from "./avatar-editor";
import PushToggle from "./push-toggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, avatar_path")
    .eq("id", auth.user?.id ?? "")
    .single();
  const avatarUrls = await signImages(AVATARS_BUCKET, [profile?.avatar_path ?? null]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <PageTitle>Settings ⚙️</PageTitle>

      <Card>
        <AvatarEditor
          name={profile?.display_name ?? "Me"}
          email={profile?.email ?? null}
          avatarUrl={profile?.avatar_path ? (avatarUrls.get(profile.avatar_path) ?? null) : null}
        />
      </Card>

      <Card>
        <PushToggle />
      </Card>

      <LogoutButton />
    </div>
  );
}
