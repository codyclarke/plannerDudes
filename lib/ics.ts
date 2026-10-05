import { createEvent, type DateArray, type EventAttributes } from "ics";

const DAY_MS = 24 * 60 * 60 * 1000;

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

// All-day options are stored at 12:00 UTC on their date, so the UTC date
// part is the intended calendar date.
function toDateOnlyArray(d: Date): DateArray {
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

export function buildIcsFile(opts: {
  eventId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  url: string;
}) {
  const common = {
    // Stable UID so re-importing updates the existing calendar entry
    // instead of creating a duplicate.
    uid: `${opts.eventId}@friend-events`,
    title: opts.title,
    description: opts.description ?? undefined,
    location: opts.location ?? undefined,
    url: opts.url,
  };
  const start = new Date(opts.startsAt);

  const attributes: EventAttributes = opts.allDay
    ? {
        ...common,
        // Date-only start/end make a VALUE=DATE all-day entry; the end date
        // is exclusive per RFC 5545, hence +1 day.
        start: toDateOnlyArray(start),
        end: toDateOnlyArray(new Date(start.getTime() + DAY_MS)),
      }
    : {
        ...common,
        start: toDateArray(opts.startsAt),
        startInputType: "utc",
        end: toDateArray(opts.endsAt ?? new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString()),
        endInputType: "utc",
      };

  const { error, value } = createEvent(attributes);

  if (error || !value) {
    throw error ?? new Error("failed to build .ics file");
  }
  return value;
}
