import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, Chip, PageTitle, SectionTitle } from "@/components/ui";
import InviteForm from "./invite-form";

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, is_owner")
    .order("display_name");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageTitle sub="Everyone here can see and vote on the events they're invited to.">
        Your crew 👯
      </PageTitle>

      <InviteForm />

      <section>
        <SectionTitle>
          Members <span className="text-muted">· {profiles?.length ?? 0}</span>
        </SectionTitle>
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <Avatar name={p.display_name} />
                <span className="font-bold">{p.display_name}</span>
                <span className="ml-auto flex gap-1.5">
                  {p.id === auth.user?.id && <Chip tone="violet">You</Chip>}
                  {p.is_owner && <Chip tone="amber">👑 Owner</Chip>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
