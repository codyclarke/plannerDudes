import { createEvent, type DateArray } from "ics";

function toDateArray(iso: string): DateArray {
  const d = new Date(iso);
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

export function buildIcsFile(opts: {
  eventId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  url: string;
}) {
  const start = toDateArray(opts.startsAt);
  const end = opts.endsAt
    ? toDateArray(opts.endsAt)
    : toDateArray(new Date(new Date(opts.startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString());

  const { error, value } = createEvent({
    // Stable UID so re-importing updates the existing calendar entry
    // instead of creating a duplicate.
    uid: `${opts.eventId}@friend-events`,
    title: opts.title,
    description: opts.description ?? undefined,
    location: opts.location ?? undefined,
    start,
    startInputType: "utc",
    end,
    endInputType: "utc",
    url: opts.url,
  });

  if (error || !value) {
    throw error ?? new Error("failed to build .ics file");
  }
  return value;
}
