/**
 * Classes are scheduled in Boise. Reminder day math and the dates printed in
 * emails use this zone, never UTC or the server's zone.
 * src/lib/countdown.ts carries its own copy of the civil-date math because
 * scripts/verify-countdown.mjs runs it under plain Node without path aliases.
 */
export const classTimeZone = "America/Boise";

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

/** The calendar date in Boise for an instant. */
export function boiseCivilDate(instant: Date): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: classTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** Calendar-day serial. Not a timezone conversion. */
export function civilDayNumber(date: CivilDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

/**
 * Whole Boise calendar days from `now` to `target`.
 * Both are converted to their Boise date first, so a DST change in between
 * does not shift the answer, and neither does the UTC date rolling over
 * before Boise's does.
 */
export function boiseDaysUntil(now: Date, target: Date): number {
  return civilDayNumber(boiseCivilDate(target)) - civilDayNumber(boiseCivilDate(now));
}

/** "Saturday, November 14, 2026" */
export function formatBoiseDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: classTimeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(instant);
}

/** "10:00 AM" */
export function formatBoiseClock(instant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: classTimeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

/** "MST" or "MDT" for the instant. */
export function boiseZoneAbbreviation(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: classTimeZone,
    timeZoneName: "short",
  }).formatToParts(instant);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "MT";
}

/** "10:00 AM to 12:00 PM MST" */
export function formatBoiseTimeRange(start: Date, end: Date): string {
  return `${formatBoiseClock(start)} to ${formatBoiseClock(end)} ${boiseZoneAbbreviation(start)}`;
}
