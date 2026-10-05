import Link from "next/link";
import { Avatar } from "@/components/ui";
import { BottomNav, TopNavLinks } from "@/components/AppNav";

export default function AppShell({
  name,
  avatarUrl,
  children,
}: {
  name: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-lg shadow-md shadow-fuchsia-500/30">
              🎉
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">Friend Events</span>
          </Link>
          <div className="flex items-center gap-3">
            <TopNavLinks />
            <Link href="/settings" aria-label="Settings" className="transition active:scale-90">
              <Avatar name={name} src={avatarUrl} />
            </Link>
          </div>
        </div>
      </header>
      {/* Bottom padding keeps content clear of the phone tab bar. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-32 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
