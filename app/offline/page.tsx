import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import OfflineApp from "./offline-app";

export const metadata: Metadata = { title: `Offline · ${APP_NAME}` };

// Data-free shell: the service worker caches this page and shows it when a
// page can't load; the events come from the snapshot saved on the device.
export default function OfflinePage() {
  return <OfflineApp />;
}
