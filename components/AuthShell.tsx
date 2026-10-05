import type { ReactNode } from "react";

/** Gradient backdrop + centered card shared by the logged-out pages. */
export default function AuthShell({
  emoji = "🎉",
  title,
  subtitle,
  children,
}: {
  emoji?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 px-4 py-10">
      {/* Floating decorations */}
      <span aria-hidden className="pointer-events-none absolute top-10 left-6 text-6xl opacity-30 -rotate-12">🎈</span>
      <span aria-hidden className="pointer-events-none absolute right-8 bottom-12 text-7xl opacity-30 rotate-12">🥳</span>
      <span aria-hidden className="pointer-events-none absolute top-1/3 right-10 text-4xl opacity-25">✨</span>

      <div className="relative w-full max-w-sm rounded-[2rem] bg-surface p-7 shadow-2xl shadow-violet-950/30">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid size-16 place-items-center rounded-3xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-4xl shadow-lg shadow-fuchsia-500/30">
            {emoji}
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
