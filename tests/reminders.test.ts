import { describe, expect, test } from "vitest";
import { reminderRecipientStatuses } from "@/config/email";
import { buildEmail } from "@/emails/build";
import type { EmailRegistration } from "@/emails/types";
import { runReminders, type ReminderDeps } from "@/lib/email/reminders";
import { fakeTransport, memoryStore, pilotEvent, registration, springEvent, testMailer } from "./helpers";

const fiveDaysOut = new Date("2026-11-09T16:00:00Z");
const oneDayOut = new Date("2026-11-13T16:00:00Z");

function roster(): EmailRegistration[] {
  return [
    registration({ status: "paid" }),
    registration({ status: "processing" }),
    registration({ status: "pending_payment" }),
    registration({ status: "pending" }),
    registration({ status: "waitlist" }),
    registration({ status: "expired" }),
    registration({ status: "failed" }),
    registration({ status: "cancelled" }),
    registration({ status: "paid", eventId: springEvent.id }),
  ];
}

/** One roster for the file, so ids and addresses stay stable across runs. */
const sharedRows = roster();

function deps(input: Partial<ReminderDeps> & { rows?: EmailRegistration[] }): ReminderDeps {
  const rows = input.rows ?? sharedRows;
  return {
    now: fiveDaysOut,
    listEvents: async () => [pilotEvent, springEvent],
    listRecipients: async (eventId, statuses) =>
      rows.filter((row) => row.eventId === eventId && statuses.includes(row.status)),
    build: buildEmail,
    mailer: testMailer({}),
    pauseMs: 0,
    ...input,
  };
}

describe("reminder recipients", () => {
  test("config lists paid, processing, and pending_payment", () => {
    expect([...reminderRecipientStatuses]).toEqual(["paid", "processing", "pending_payment"]);
  });

  test("only reminder statuses on the due class get the 5-day email", async () => {
    const transport = fakeTransport();
    const run = await runReminders(deps({ mailer: testMailer({ transport }) }));
    expect(run.events).toHaveLength(1);
    expect(run.events[0]).toMatchObject({
      slug: "sawdust-and-slice",
      kind: "reminder_5d",
      daysOut: 5,
      recipients: 3,
      sent: 3,
    });
    const recipients = transport.sent.map((message) => message.to).sort();
    expect(recipients).toEqual(["parent1@example.com", "parent2@example.com", "parent3@example.com"]);
    expect(transport.sent[0].subject).toBe("Sawdust & Slice is in 5 days");
    expect(transport.sent[0].idempotencyKey).toMatch(/^reminder_5d:/);
  });

  test("dropping pending_payment from the config drops those families", async () => {
    const transport = fakeTransport();
    const run = await runReminders(
      deps({ mailer: testMailer({ transport }), statuses: ["paid", "processing"] }),
    );
    expect(run.totals.sent).toBe(2);
    expect(transport.sent.map((message) => message.to)).not.toContain("parent3@example.com");
  });

  test("the day before sends the 1-day email", async () => {
    const transport = fakeTransport();
    const run = await runReminders(deps({ now: oneDayOut, mailer: testMailer({ transport }) }));
    expect(run.events[0]).toMatchObject({ kind: "reminder_1d", daysOut: 1, sent: 3 });
    expect(transport.sent[0].subject).toBe("Sawdust & Slice is tomorrow");
    expect(transport.sent[0].text).toContain("Class is tomorrow.");
  });

  test("a day that is neither 5 nor 1 out sends nothing", async () => {
    const transport = fakeTransport();
    const run = await runReminders(
      deps({ now: new Date("2026-11-11T16:00:00Z"), mailer: testMailer({ transport }) }),
    );
    expect(run.events).toHaveLength(0);
    expect(transport.sent).toHaveLength(0);
  });

  test("the second run on the same day sends nothing", async () => {
    const store = memoryStore();
    const transport = fakeTransport();
    const mailer = testMailer({ store, transport });
    const first = await runReminders(deps({ mailer }));
    expect(first.totals.sent).toBe(3);
    const second = await runReminders(deps({ mailer }));
    expect(second.totals).toEqual({ recipients: 3, sent: 0, skipped: 0, failed: 0, already: 3 });
    expect(transport.sent).toHaveLength(3);
  });

  test("the 1-day pass is separate from the 5-day pass", async () => {
    const store = memoryStore();
    const transport = fakeTransport();
    const mailer = testMailer({ store, transport });
    await runReminders(deps({ mailer, now: fiveDaysOut }));
    const later = await runReminders(deps({ mailer, now: oneDayOut }));
    expect(later.totals.sent).toBe(3);
    expect(transport.sent).toHaveLength(6);
  });

  test("without an API key everything is skipped and the run still reports", async () => {
    const store = memoryStore();
    const run = await runReminders(deps({ mailer: testMailer({ store, transport: null }) }));
    expect(run.configured).toBe(false);
    expect(run.totals).toMatchObject({ recipients: 3, sent: 0, skipped: 3 });
    expect([...store.rows.values()].every((row) => row.status === "skipped")).toBe(true);
  });

  test("one failing address does not stop the rest", async () => {
    const transport = fakeTransport({ failFor: (message) => message.to === "parent2@example.com" });
    const run = await runReminders(deps({ mailer: testMailer({ transport }) }));
    expect(run.totals).toMatchObject({ sent: 2, failed: 1 });
  });
});
