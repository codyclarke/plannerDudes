"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { refreshSnapshot } from "@/lib/offline-store";

/**
 * Keeps the on-device offline snapshot fresh while the app is used online:
 * on load and navigation (throttled), on coming back to the app, on
 * reconnecting — and forced when leaving the app, so a vote cast just before
 * losing signal is still in it.
 */
export default function OfflineSync() {
  const pathname = usePathname();

  useEffect(() => {
    refreshSnapshot();
  }, [pathname]);

  useEffect(() => {
    const onVisibility = () => refreshSnapshot({ force: document.visibilityState === "hidden" });
    const onOnline = () => refreshSnapshot();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
