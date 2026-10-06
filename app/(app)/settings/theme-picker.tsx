"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "☀️ Light" },
  { value: "dark", label: "🌙 Dark" },
  { value: "system", label: "📱 Auto" },
];

/**
 * Saves the choice and applies it immediately. Kept outside the component:
 * it writes to `document`, which React's rules don't allow inside one.
 */
function applyTheme(theme: Theme) {
  // Saved per device for a year; the server reads it to render the right
  // theme on first paint (see app/layout.tsx).
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

/** Settings control for light/dark mode (saved on this device). */
export default function ThemePicker({ initial }: { initial: Theme }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    // Switch is already visible; refresh so server-rendered bits (the
    // browser / status-bar color) follow.
    router.refresh();
  }

  return (
    <div>
      <p className="font-bold">🎨 Appearance</p>
      <p className="mb-3 text-sm text-muted">Auto follows your phone or computer setting. Saved on this device.</p>
      <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => choose(o.value)}
            className={cn(
              "rounded-xl px-1 py-2 text-sm font-extrabold transition",
              theme === o.value ? "bg-violet-600 text-white shadow-md shadow-violet-500/30" : "text-muted hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
