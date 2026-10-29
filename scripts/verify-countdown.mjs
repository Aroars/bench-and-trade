import assert from "node:assert/strict";
import { classCountdown, dayCountLabel } from "../src/lib/countdown.ts";

const start = "2026-11-14T10:00:00-07:00";

assert.equal(dayCountLabel(1), "1 DAY");
assert.equal(dayCountLabel(20), "20 DAYS");

const twenty = classCountdown(new Date("2026-10-25T20:05:00Z"), start);
assert.equal(twenty?.big, "20 DAYS");
assert.equal(twenty?.small, "until class");

const stillTwenty = classCountdown(new Date("2026-10-26T05:30:00Z"), start);
assert.equal(stillTwenty?.big, "20 DAYS", "Boise date must not follow UTC");

const tomorrow = classCountdown(new Date("2026-11-14T06:30:00Z"), start);
assert.equal(tomorrow?.big, "1 DAY");
assert.equal(tomorrow?.small, "tomorrow");

const today = classCountdown(new Date("2026-11-14T16:30:00Z"), start);
assert.equal(today?.big, "TODAY");

assert.equal(classCountdown(new Date("2026-11-14T17:00:00Z"), start), null);
assert.equal(classCountdown(new Date("2026-11-14T18:00:00Z"), start), null);

console.log("verify-countdown: Boise day counts passed");
