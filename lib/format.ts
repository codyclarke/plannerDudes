// Every date shown in the UI or in emails goes through here so it renders
// in the group's timezone. Without a fixed zone, server-rendered pages and
// emails would use the server's timezone (UTC on Vercel), and server/client
// renders of the same component could disagree.
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Los_Angeles";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

// All-day options are stored as 12:00 UTC on their date (see
// 0003_all_day_options.sql), so the UTC date part *is* the intended date.
const dateOnlyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function formatWhen(iso: string, allDay = false) {
  return allDay
    ? dateOnlyFormatter.format(new Date(iso))
    : dateTimeFormatter.format(new Date(iso));
}

/** Pieces for a calendar-tile badge: { weekday: "Sat", month: "Oct", day: "10", time: "6:00 PM" | null }. */
export function dateParts(iso: string, allDay = false) {
  const d = new Date(iso);
  const timeZone = allDay ? "UTC" : APP_TIMEZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    month: get("month"),
    day: get("day"),
    time: allDay
      ? null
      : new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d),
  };
}

/** "YYYY-MM-DD" -> the stored starts_at for an all-day option. */
export function allDayStartsAt(date: string) {
  return `${date}T12:00:00.000Z`;
}

/** stored starts_at of an all-day option -> its "YYYY-MM-DD" date. */
export function allDayDateKey(startsAt: string) {
  return new Date(startsAt).toISOString().slice(0, 10);
}

/** Calendar date ("YYYY-MM-DD") of an instant, in the app's timezone. */
export function dateKeyInAppZone(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);
}
