"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/app";
import { PERGOLA_COOKIE } from "@/lib/pergola";

const TAPS_NEEDED = 5;
const TAP_WINDOW_MS = 1500; // max gap between taps before the count resets

/**
 * Flips Pergola mode on this device. Kept outside the component: it writes
 * to `document`, which React's rules don't allow inside one.
 */
function togglePergola() {
  const on = !document.documentElement.hasAttribute("data-pergola");
  document.cookie = on
    ? `${PERGOLA_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    : `${PERGOLA_COOKIE}=; path=/; max-age=0; samesite=lax`;
  if (on) document.documentElement.setAttribute("data-pergola", "");
  else document.documentElement.removeAttribute("data-pergola");
  return on;
}

/**
 * The header logo. Still a normal link home — but tap it 5 times quickly
 * and… 🪵. Name and icon swap via the pergola: CSS variant.
 */
export function PergolaLogo() {
  const router = useRouter();
  const taps = useRef({ count: 0, last: 0 });
  const [toast, setToast] = useState<string | null>(null);

  function onTap() {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.last > TAP_WINDOW_MS ? 1 : t.count + 1;
    t.last = now;
    if (t.count < TAPS_NEEDED) return;

    t.count = 0;
    const on = togglePergola();
    setToast(on ? "🪵 Pergola mode activated. Shade has been achieved." : "Pergola mode off. Back indoors.");
    setTimeout(() => setToast(null), 3000);
    router.refresh(); // so the server-rendered status-bar color follows
  }

  return (
    <>
      <Link href="/dashboard" onClick={onTap} className="flex items-center gap-2 select-none">
        <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-600 via-fuchsia-500 to-orange-400 text-lg shadow-md shadow-fuchsia-500/30">
          <span className="pergola:hidden">🎉</span>
          <span className="hidden pergola:inline">🪵</span>
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">
          <span className="pergola:hidden">{APP_NAME}</span>
          <span className="hidden pergola:inline">Pergola Planner</span>
        </span>
      </Link>
      {toast && (
        <div
          role="status"
          className="fixed top-20 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-bold text-background shadow-xl"
        >
          {toast}
        </div>
      )}
    </>
  );
}

// Bulb/vine positions as percentages across the beam. Fixed lists (not
// random) so server and client render the same markup.
const BULBS = [4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92];
const VINES: [number, string, number][] = [
  [7, "🌿", 0],
  [23, "🍃", 1.2],
  [41, "🌿", 0.6],
  [58, "🌸", 2],
  [74, "🍃", 0.3],
  [90, "🌿", 1.6],
];

/** Cedar beam, hanging vines and string lights under the header (pergola mode only). */
export function PergolaDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full hidden h-10 pergola:block">
      <div className="pergola-beams h-3 w-full" />
      {VINES.map(([left, emoji, delay]) => (
        <span
          key={left}
          className="pergola-vine absolute top-1 text-lg leading-none"
          style={{ left: `${left}%`, animationDelay: `${delay}s` }}
        >
          {emoji}
        </span>
      ))}
      {/* the light string sags slightly between beams */}
      <svg className="absolute top-2.5 left-0 h-4 w-full" preserveAspectRatio="none" viewBox="0 0 100 10">
        <path d="M0 2 Q 12.5 8 25 2 T 50 2 T 75 2 T 100 2" fill="none" stroke="#3b2a1a" strokeWidth="0.4" />
      </svg>
      {BULBS.map((left, i) => (
        <span
          key={left}
          className="pergola-bulb absolute"
          style={{ left: `${left}%`, top: i % 2 ? "17px" : "13px", animationDelay: `${(i * 0.37) % 2.6}s` }}
        />
      ))}
    </div>
  );
}
