import { describe, expect, test } from "vitest";
import { idempotencyKeyFor, type SendJob } from "@/lib/email/mailer";
import { fakeTransport, memoryStore, pilotEvent, registration, testMailer } from "./helpers";

function job(overrides: Partial<SendJob> = {}): SendJob {
  const reg = registration();
  return {
    registrationId: reg.id,
    eventId: pilotEvent.id,
    kind: "confirmation_paid",
    to: reg.parentEmail,
    subject: "Hi",
    html: "<p>Hi</p>",
    text: "Hi",
    ...overrides,
  };
}

describe("mailer", () => {
  test("sends once and records the provider id", async () => {
    const store = memoryStore();
    const transport = fakeTransport();
    const mailer = testMailer({ store, transport });
    const first = await mailer.send(job({ registrationId: "r1" }));
    expect(first).toEqual({ status: "sent", id: "re_1" });
    expect(transport.sent[0]).toMatchObject({
      to: expect.stringContaining("@example.com"),
      from: "Bench & Trade <classes@send.benchandtrade.com>",
      idempotencyKey: "confirmation_paid:r1",
    });
    expect(transport.sent[0].replyTo).toBeUndefined();
    expect([...store.rows.values()]).toEqual([
      expect.objectContaining({ registrationId: "r1", status: "sent", resendId: "re_1", error: null }),
    ]);
  });

  test("a second send for the same key is a no-op", async () => {
    const store = memoryStore();
    const transport = fakeTransport();
    const mailer = testMailer({ store, transport });
    await mailer.send(job({ registrationId: "r1" }));
    const again = await mailer.send(job({ registrationId: "r1" }));
    expect(again).toEqual({ status: "already", previous: "sent" });
    expect(transport.sent).toHaveLength(1);
  });

  test("without an API key the send is logged as skipped and nothing throws", async () => {
    const store = memoryStore();
    const lines: string[] = [];
    const mailer = testMailer({ store, transport: null, logLines: lines });
    expect(mailer.configured).toBe(false);
    const outcome = await mailer.send(job({ registrationId: "r2", kind: "waitlist" }));
    expect(outcome).toEqual({ status: "skipped", reason: "RESEND_API_KEY unset" });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^email skipped kind=waitlist registration=r2/);
    expect([...store.rows.values()][0]).toMatchObject({ status: "skipped", resendId: null });

    const again = await mailer.send(job({ registrationId: "r2", kind: "waitlist" }));
    expect(again).toEqual({ status: "already", previous: "skipped" });
  });

  test("a provider failure is recorded as failed, never thrown, and can be retried", async () => {
    const store = memoryStore();
    let fail = true;
    const transport = fakeTransport({ failFor: () => fail });
    const mailer = testMailer({ store, transport });
    const first = await mailer.send(job({ registrationId: "r3" }));
    expect(first.status).toBe("failed");
    expect([...store.rows.values()][0]).toMatchObject({ status: "failed", error: "Error: boom" });

    fail = false;
    const second = await mailer.send(job({ registrationId: "r3" }));
    expect(second.status).toBe("sent");
    expect([...store.rows.values()][0]).toMatchObject({ status: "sent", error: null });
  });

  test("a broken log store does not throw out of send", async () => {
    const lines: string[] = [];
    const mailer = testMailer({
      store: {
        async findLog() {
          throw new Error("db down");
        },
        async recordLog() {
          throw new Error("db down");
        },
      },
      logLines: lines,
    });
    const outcome = await mailer.send(job());
    expect(outcome.status).toBe("failed");
    expect(lines[0]).toContain("db down");
  });

  test("idempotency keys separate new-class sends per class", () => {
    expect(idempotencyKeyFor({ registrationId: "r", kind: "reminder_5d", eventId: "e1" })).toBe(
      "reminder_5d:r",
    );
    expect(
      idempotencyKeyFor({ registrationId: "r", kind: "waitlist_new_class", eventId: "e2" }),
    ).toBe("waitlist_new_class:r:e2");
  });
});
