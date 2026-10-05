// Voting deadline rules, shared by the UI (countdowns), the votes route
// (enforcement) and the daily cron job (nudges). Pure functions: callers
// pass `now` in.
import { APP_TIMEZONE, dateKeyInAppZone } from "./format";

export type NudgeStage = "nudge_3d" | "nudge_1d" | "nudge_today";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days (in the group's timezone) from `now` until `iso`. */
export function calendarDaysUntil(iso: string, now: Date) {
  const from = Date.parse(`${dateKeyInAppZone(now)}T00:00:00Z`);
  const to = Date.parse(`${dateKeyInAppZone(new Date(iso))}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

export function isVotingClosed(closesAt: string | null, now: Date) {
  return !!closesAt && new Date(closesAt).getTime() <= now.getTime();
}

/**
 * Which "you haven't voted" nudge is due today, if any: 3 days out, the day
 * before, and the day it closes. The daily cron runs once, so each stage
 * matches on exactly one run; notifications_log keeps it to once per event.
 */
export function nudgeStage(closesAt: string, now: Date): NudgeStage | null {
  if (isVotingClosed(closesAt, now)) return null;
  const days = calendarDaysUntil(closesAt, now);
  return days === 3 ? "nudge_3d" : days === 1 ? "nudge_1d" : days === 0 ? "nudge_today" : null;
}

export const NUDGE_COPY: Record<NudgeStage, string> = {
  nudge_3d: "Voting closes in 3 days — pick the dates that work for you.",
  nudge_1d: "Voting closes tomorrow — get your vote in!",
  nudge_today: "Last call! Voting closes tonight.",
};

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** Countdown for badges/banners, or null when there's no deadline. */
export function describeDeadline(closesAt: string | null, now: Date) {
  if (!closesAt) return null;
  const day = dayFormatter.format(new Date(closesAt));
  if (isVotingClosed(closesAt, now)) {
    return { closed: true, urgent: false, short: "Voting closed", long: `Voting closed ${day}` };
  }
  const days = calendarDaysUntil(closesAt, now);
  const when = days <= 0 ? "tonight" : days === 1 ? "tomorrow" : `in ${days} days`;
  return {
    closed: false,
    urgent: days <= 1,
    short: `Closes ${when}`,
    long: `Voting closes ${when} (${day})`,
  };
}

export type Deadline = NonNullable<ReturnType<typeof describeDeadline>>;

/** Browser-side: "YYYY-MM-DD" from a date input -> end of that day, local time, as ISO. */
export function endOfDayIso(date: string) {
  return new Date(`${date}T23:59:59`).toISOString();
}
