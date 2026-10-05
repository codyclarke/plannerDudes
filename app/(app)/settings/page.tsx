import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, PageTitle } from "@/components/ui";
import LogoutButton from "@/components/LogoutButton";
import PushToggle from "./push-toggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", auth.user?.id ?? "")
    .single();
  const name = profile?.display_name ?? "Me";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <PageTitle>Settings ⚙️</PageTitle>

      <Card className="flex items-center gap-4">
        <Avatar name={name} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">{name}</p>
          <p className="truncate text-sm text-muted">{profile?.email}</p>
        </div>
      </Card>

      <Card>
        <PushToggle />
      </Card>

      <LogoutButton />
    </div>
  );
}
