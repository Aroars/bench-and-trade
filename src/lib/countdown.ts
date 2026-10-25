const BOISE = "America/Boise";

type CivilDate = {
  year: number;
  month: number;
  day: number;
};

export type ClassCountdownView = {
  big: string;
  small: string;
  aria: string;
};

function civilDate(instant: Date): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOISE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** Calendar-day serial. Not a timezone conversion. */
function civilDayNumber(date: CivilDate): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

export function dayCountLabel(days: number): string {
  return `${days} ${days === 1 ? "DAY" : "DAYS"}`;
}

/**
 * Days are Boise calendar dates, compared to the class start instant.
 * After that instant the countdown is hidden.
 */
export function classCountdown(now: Date, startsAtIso: string): ClassCountdownView | null {
  const start = new Date(startsAtIso);
  if (Number.isNaN(start.getTime()) || now.getTime() >= start.getTime()) {
    return null;
  }

  const days = civilDayNumber(civilDate(start)) - civilDayNumber(civilDate(now));
  if (days <= 0) {
    return {
      big: "TODAY",
      small: "class day",
      aria: "Class is today",
    };
  }
  if (days === 1) {
    return {
      big: dayCountLabel(1),
      small: "tomorrow",
      aria: "1 day until class. Tomorrow.",
    };
  }
  return {
    big: dayCountLabel(days),
    small: "until class",
    aria: `${days} days until class`,
  };
}
