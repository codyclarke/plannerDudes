import Link from "next/link";
import { Avatar } from "@/components/ui";
import { BottomNav, TopNavLinks } from "@/components/AppNav";
import { PergolaDecor, PergolaLogo } from "@/components/Pergola";

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
          {/* Links home; tap 5 times for 🪵 Pergola mode. */}
          <PergolaLogo />
          <div className="flex items-center gap-3">
            <TopNavLinks />
            <Link href="/settings" aria-label="Settings" className="transition active:scale-90">
              <Avatar name={name} src={avatarUrl} />
            </Link>
          </div>
        </div>
        <PergolaDecor />
      </header>
      {/* Bottom padding keeps content clear of the phone tab bar (and, in
          pergola mode, the top padding clears the beam hanging off the header). */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-32 pergola:pt-14 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
