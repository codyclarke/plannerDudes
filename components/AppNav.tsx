"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClasses, cn } from "@/components/ui";

const TABS = [
  { href: "/dashboard", label: "Events", icon: "🏠" },
  { href: "/invite", label: "Friends", icon: "👯" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href === "/dashboard" && pathname.startsWith("/events/") && pathname !== "/events/new");
}

/** Desktop links in the top bar (hidden on phones). */
export function TopNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-bold transition",
            isActive(pathname, t.href)
              ? "bg-violet-500/12 text-violet-700 dark:text-violet-300"
              : "text-muted hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
      <Link href="/events/new" className={cn(buttonClasses("primary"), "ml-2")}>
        + New event
      </Link>
    </nav>
  );
}

/** Phone tab bar: Events | big + | Friends. */
export function BottomNav() {
  const pathname = usePathname();
  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(pathname, t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-extrabold transition",
          active ? "text-violet-600 dark:text-violet-300" : "text-muted"
        )}
      >
        <span className={cn("text-2xl transition", active ? "scale-110" : "opacity-70 grayscale")}>
          {t.icon}
        </span>
        {t.label}
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-end px-6">
        {tab(TABS[0])}
        <Link
          href="/events/new"
          aria-label="New event"
          className="-mt-6 grid size-16 place-items-center rounded-full bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-3xl font-bold text-white shadow-xl shadow-fuchsia-500/40 ring-4 ring-background transition active:scale-90"
        >
          +
        </Link>
        {tab(TABS[1])}
      </div>
    </nav>
  );
}
