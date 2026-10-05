import { createClient } from "@/lib/supabase/server";
import { loadPeople } from "@/lib/people.server";
import { Avatar, Card, Chip, PageTitle, SectionTitle } from "@/components/ui";
import InviteForm from "./invite-form";
import PendingInvites, { type PendingInvite } from "./pending-invites";
import MemberReset from "./member-reset";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(iso: string, now: number) {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// Shapes pending invites for display. Lives outside the component because it
// reads the clock (render functions must stay pure).
function describeInvites(
  invites: { id: string; email: string; token: string; invited_by: string; last_sent_at: string; expires_at: string }[],
  nameOf: (id: string) => string
): PendingInvite[] {
  const now = Date.now();
  return invites.map((i) => {
    const msLeft = new Date(i.expires_at).getTime() - now;
    const daysLeft = Math.ceil(msLeft / DAY_MS);
    return {
      id: i.id,
      email: i.email,
      signupPath: `/signup/${i.token}`,
      invitedBy: nameOf(i.invited_by),
      sentText: `sent ${daysAgo(i.last_sent_at, now)}`,
      expired: msLeft <= 0,
      expiresText: msLeft <= 0 ? "Expired" : daysLeft === 1 ? "Expires tomorrow" : `${daysLeft} days left`,
    };
  });
}

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [people, { data: invites }] = await Promise.all([
    loadPeople(supabase),
    supabase
      .from("invites")
      .select("id, email, token, invited_by, last_sent_at, expires_at")
      .eq("status", "pending")
      .order("last_sent_at", { ascending: false }),
  ]);
  const me = people.list.find((p) => p.id === auth.user?.id);
  const pending = describeInvites(invites ?? [], (id) => people.get(id).name);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageTitle sub="Everyone here can see and vote on every event.">Your crew 🍻</PageTitle>

      <InviteForm />

      {pending.length > 0 && (
        <section>
          <SectionTitle>
            Pending invites <span className="text-muted">· {pending.length}</span>
          </SectionTitle>
          <PendingInvites invites={pending} />
        </section>
      )}

      <section>
        <SectionTitle>
          Members <span className="text-muted">· {people.list.length}</span>
        </SectionTitle>
        <Card className="p-2">
          <ul className="divide-y divide-line">
            {people.list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
                <Avatar name={p.name} src={p.avatarUrl} />
                <span className="font-bold">{p.name}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {p.id === auth.user?.id && <Chip tone="violet">You</Chip>}
                  {p.isOwner && <Chip tone="amber">👑 Owner</Chip>}
                  {/* Owner can send anyone else a reset link (you'd use "Forgot password" for yourself). */}
                  {me?.isOwner && p.id !== me.id && <MemberReset memberId={p.id} name={p.name} />}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
