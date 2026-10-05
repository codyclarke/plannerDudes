import { createClient } from "@/lib/supabase/server";
import { loadPeople } from "@/lib/people.server";
import { Avatar, Card, Chip, PageTitle, SectionTitle } from "@/components/ui";
import InviteForm from "./invite-form";

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const people = await loadPeople(supabase);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageTitle sub="Everyone here can see and vote on the events they're invited to.">
        Your crew 👯
      </PageTitle>

      <InviteForm />

      <section>
        <SectionTitle>
          Members <span className="text-muted">· {people.list.length}</span>
        </SectionTitle>
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {people.list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <Avatar name={p.name} src={p.avatarUrl} />
                <span className="font-bold">{p.name}</span>
                <span className="ml-auto flex gap-1.5">
                  {p.id === auth.user?.id && <Chip tone="violet">You</Chip>}
                  {p.isOwner && <Chip tone="amber">👑 Owner</Chip>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
