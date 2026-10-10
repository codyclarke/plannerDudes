// Read-only copy of the signed-in person's upcoming events, saved on the
// device so the installed app can show them without a connection.
import type { DashboardEvent } from "@/app/(app)/dashboard/dashboard-view";

type Response = "yes" | "maybe" | "no";

export type OfflineEvent = {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  location: string | null;
  spousesInvited: boolean;
  kidsAllowed: boolean;
  status: "polling" | "finalized" | "cancelled";
  fixedDate: boolean;
  organizerName: string;
  votingClosesAt: string | null;
  options: {
    id: string;
    startsAt: string;
    allDay: boolean;
    label: string | null;
    yes: number;
    maybe: number;
    no: number;
    yesNames: string[];
    myResponse: Response | null;
  }[];
  finalizedOptionId: string | null;
  /** Who said yes to the locked-in date, with their extras. */
  going: { name: string; adults: number; kids: number }[];
  maybeNames: string[];
  places: {
    id: string;
    title: string | null;
    url: string;
    siteName: string | null;
    yes: number;
    maybe: number;
    no: number;
    myResponse: Response | null;
  }[];
  chosenPlaceId: string | null;
};

export type OfflineSnapshot = {
  version: 1;
  userId: string;
  myName: string;
  /** ISO time the snapshot was taken (shown as "saved 2:15 PM"). */
  savedAt: string;
  dashboard: DashboardEvent[];
  events: Record<string, OfflineEvent>;
};
