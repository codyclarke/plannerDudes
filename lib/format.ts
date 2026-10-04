// Every date shown in the UI or in emails goes through here so it renders
// in the group's timezone. Without a fixed zone, server-rendered pages and
// emails would use the server's timezone (UTC on Vercel), and server/client
// renders of the same component could disagree.
const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Los_Angeles";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function formatWhen(iso: string) {
  return formatter.format(new Date(iso));
}
