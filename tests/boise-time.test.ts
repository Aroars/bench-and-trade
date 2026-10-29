import { describe, expect, test } from "vitest";
import {
  boiseCivilDate,
  boiseDaysUntil,
  formatBoiseDate,
  formatBoiseTimeRange,
} from "@/lib/boise-time";
import { reminderDue } from "@/lib/email/reminders";
import { pilotEvent, springEvent } from "./helpers";

// The pilot starts 2026-11-14 10:00 MST (17:00Z). DST ended on 2026-11-01.
const pilotStart = new Date(pilotEvent.startsAt);

describe("Boise calendar days", () => {
  test("reads the Boise date, not the UTC date", () => {
    // 05:30Z on Nov 10 is still 22:30 on Nov 9 in Boise.
    expect(boiseCivilDate(new Date("2026-11-10T05:30:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 9,
    });
  });

  test("five days out at the 16:00 UTC cron time", () => {
    expect(boiseDaysUntil(new Date("2026-11-09T16:00:00Z"), pilotStart)).toBe(5);
  });

  test("one day out at the 16:00 UTC cron time", () => {
    expect(boiseDaysUntil(new Date("2026-11-13T16:00:00Z"), pilotStart)).toBe(1);
  });

  test("late Boise evening does not roll to the next day with UTC", () => {
    // Nov 9, 22:30 Boise. UTC already says Nov 10.
    expect(boiseDaysUntil(new Date("2026-11-10T05:30:00Z"), pilotStart)).toBe(5);
  });

  test("the day before and after a reminder day are not reminder days", () => {
    expect(boiseDaysUntil(new Date("2026-11-08T16:00:00Z"), pilotStart)).toBe(6);
    expect(boiseDaysUntil(new Date("2026-11-10T16:00:00Z"), pilotStart)).toBe(4);
    expect(boiseDaysUntil(new Date("2026-11-14T16:00:00Z"), pilotStart)).toBe(0);
    expect(boiseDaysUntil(new Date("2026-11-15T16:00:00Z"), pilotStart)).toBe(-1);
  });

  test("spring forward between now and class still counts calendar days", () => {
    // Class 2027-03-15 10:00 MDT (16:00Z). DST starts 2027-03-14.
    // Now is 2027-03-10 10:00 MST (17:00Z): 119 hours before class.
    const start = new Date(springEvent.startsAt);
    expect(boiseDaysUntil(new Date("2027-03-10T17:00:00Z"), start)).toBe(5);
    expect(boiseDaysUntil(new Date("2027-03-14T17:00:00Z"), start)).toBe(1);
  });

  test("fall back between now and class still counts calendar days", () => {
    // Class 2026-11-04 10:00 MST (17:00Z). DST ends 2026-11-01.
    // Now is 2026-10-30 10:00 MDT (16:00Z): 121 hours before class.
    const start = new Date("2026-11-04T17:00:00Z");
    expect(boiseDaysUntil(new Date("2026-10-30T16:00:00Z"), start)).toBe(5);
    expect(boiseDaysUntil(new Date("2026-11-03T16:00:00Z"), start)).toBe(1);
  });
});

describe("reminderDue", () => {
  test("picks the 5-day and 1-day kinds and nothing else", () => {
    expect(reminderDue(new Date("2026-11-09T16:00:00Z"), pilotEvent)).toEqual({
      kind: "reminder_5d",
      days: 5,
    });
    expect(reminderDue(new Date("2026-11-13T16:00:00Z"), pilotEvent)).toEqual({
      kind: "reminder_1d",
      days: 1,
    });
    expect(reminderDue(new Date("2026-11-12T16:00:00Z"), pilotEvent)).toBeNull();
    expect(reminderDue(new Date("2026-11-14T16:00:00Z"), pilotEvent)).toBeNull();
    expect(reminderDue(new Date("2026-11-20T16:00:00Z"), pilotEvent)).toBeNull();
  });

  test("ignores an event with a broken date", () => {
    expect(reminderDue(new Date(), { ...pilotEvent, startsAt: "not a date" })).toBeNull();
  });
});

describe("Boise labels", () => {
  test("date and time range print in Boise time with the zone", () => {
    const start = new Date(pilotEvent.startsAt);
    const end = new Date(pilotEvent.endsAt);
    expect(formatBoiseDate(start)).toBe("Saturday, November 14, 2026");
    expect(formatBoiseTimeRange(start, end)).toBe("10:00 AM to 12:00 PM MST");
    const spring = new Date(springEvent.startsAt);
    expect(formatBoiseTimeRange(spring, new Date(springEvent.endsAt))).toBe(
      "10:00 AM to 12:00 PM MDT",
    );
  });
});
