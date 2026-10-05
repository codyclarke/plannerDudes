import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET } from "@/lib/images";
import { signImages } from "@/lib/images.server";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", auth.user.id)
    .single();
  const avatarUrls = await signImages(AVATARS_BUCKET, [profile?.avatar_path ?? null]);

  return (
    <AppShell
      name={profile?.display_name ?? "Me"}
      avatarUrl={profile?.avatar_path ? (avatarUrls.get(profile.avatar_path) ?? null) : null}
    >
      {children}
    </AppShell>
  );
}
