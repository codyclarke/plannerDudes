import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold">
            Friend Events
          </Link>
          <Link href="/events/new">New event</Link>
          <Link href="/invite">Invite</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <LogoutButton />
      </header>
      <main className="px-4 py-6">{children}</main>
    </div>
  );
}
