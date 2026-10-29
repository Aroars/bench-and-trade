import { describe, expect, test } from "vitest";
import { buildEmail } from "@/emails/build";
import type { EmailRegistration } from "@/emails/types";
import {
  notifyWaitlist,
  previewWaitlistNotify,
  selectWaitlistRecipients,
  type WaitlistNotifyDeps,
} from "@/lib/email/waitlist-notify";
import { fakeTransport, memoryStore, pilotEvent, registration, springEvent, testMailer } from "./helpers";

const SECRET = "test-secret";

function waitlist(): EmailRegistration[] {
  return [
    registration({ status: "waitlist", parentEmail: "ada@example.com" }),
    registration({ status: "waitlist", parentEmail: "Ada@Example.com" }),
    registration({ status: "waitlist", parentEmail: "bo@example.com" }),
    registration({ status: "waitlist", parentEmail: "cy@example.com" }),
    registration({ status: "waitlist", parentEmail: "di@example.com", eventId: springEvent.id }),
    registration({ status: "paid", parentEmail: "paid@example.com" }),
  ];
}

function deps(input: Partial<WaitlistNotifyDeps> & { rows?: EmailRegistration[]; notified?: string[] }) {
  const rows = input.rows ?? waitlist();
  const store = memoryStore();
  const transport = fakeTransport();
  const full: WaitlistNotifyDeps = {
    getEvent: async (id) => [pilotEvent, springEvent].find((event) => event.id === id) ?? null,
    listWaitlist: async () => rows,
    listOptOuts: async () => ["cy@example.com"],
    listNotified: async (eventId) =>
      [...store.rows.values()]
        .filter((row) => row.eventId === eventId && row.kind === "waitlist_new_class" && row.status !== "failed")
        .map((row) => row.registrationId),
    build: buildEmail,
    mailer: testMailer({ store, transport }),
    siteOrigin: "https://benchandtrade.com",
    unsubscribeSecret: SECRET,
    pauseMs: 0,
    ...input,
  };
  return { deps: full, store, transport };
}

describe("selectWaitlistRecipients", () => {
  test("one per family, skipping the new class, opt-outs, and non-waitlist rows", () => {
    const selection = selectWaitlistRecipients({
      target: springEvent,
      waitlist: waitlist(),
      optOuts: ["CY@example.com"],
    });
    expect(selection.recipients.map((row) => row.parentEmail)).toEqual([
      "ada@example.com",
      "bo@example.com",
    ]);
    expect(selection.duplicates).toHaveLength(1);
    expect(selection.optedOut).toBe(1);
    expect(selection.sameClass).toBe(1);
  });
});

describe("previewWaitlistNotify", () => {
  test("counts the families who would get the email", async () => {
    const { deps: d } = deps({});
    const preview = await previewWaitlistNotify(d, springEvent.id);
    expect(preview).toMatchObject({
      count: 2,
      alreadyNotified: 0,
      optedOut: 1,
      duplicates: 1,
      emails: ["ada@example.com", "bo@example.com"],
    });
    expect(preview?.event.slug).toBe("birdhouse-and-bagels");
  });

  test("returns null for an unknown class", async () => {
    const { deps: d } = deps({});
    expect(await previewWaitlistNotify(d, "33333333-3333-4333-8333-333333333333")).toBeNull();
  });
});

describe("notifyWaitlist", () => {
  test("sends once per family with a sign-up link and a signed opt-out link", async () => {
    const { deps: d, transport } = deps({});
    const run = await notifyWaitlist(d, springEvent.id);
    expect(run).toMatchObject({ recipients: 2, sent: 2, duplicates: 1, optedOut: 1 });
    expect(transport.sent.map((message) => message.to)).toEqual(["ada@example.com", "bo@example.com"]);
    const first = transport.sent[0];
    expect(first.subject).toBe("A new class just opened: Birdhouse & Bagels");
    expect(first.html).toContain("https://benchandtrade.com/events/birdhouse-and-bagels");
    expect(first.html).toMatch(/\/api\/email\/unsubscribe\?e=ada%40example\.com&amp;t=[0-9a-f]{64}/);
    expect(first.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/benchandtrade\.com\/api\/email\/unsubscribe\?/);
    expect(first.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(first.idempotencyKey).toMatch(new RegExp(`^waitlist_new_class:.*:${springEvent.id}$`));
  });

  test("pressing send twice does not email twice, and the preview shows it", async () => {
    const { deps: d, transport } = deps({});
    await notifyWaitlist(d, springEvent.id);
    const again = await notifyWaitlist(d, springEvent.id);
    expect(again).toMatchObject({ sent: 0, already: 2 });
    expect(transport.sent).toHaveLength(2);
    const preview = await previewWaitlistNotify(d, springEvent.id);
    expect(preview).toMatchObject({ count: 0, alreadyNotified: 2 });
  });

  test("a later class notifies the same families again", async () => {
    const { deps: d, transport } = deps({});
    await notifyWaitlist(d, springEvent.id);
    const third = { ...springEvent, id: "44444444-4444-4444-8444-444444444444", slug: "third" };
    const run = await notifyWaitlist(
      { ...d, getEvent: async (id) => (id === third.id ? third : null) },
      third.id,
    );
    // Ada, Bo, and now Di, whose waitlist row was for the spring class.
    expect(run?.sent).toBe(3);
    expect(transport.sent).toHaveLength(5);
  });

  test("without a secret the email still goes out, without an opt-out link", async () => {
    const { deps: d, transport } = deps({ unsubscribeSecret: null });
    await notifyWaitlist(d, springEvent.id);
    expect(transport.sent[0].html).not.toContain("/api/email/unsubscribe");
    expect(transport.sent[0].headers).toBeUndefined();
  });

  test("without an API key the run is all skipped", async () => {
    const store = memoryStore();
    const { deps: d } = deps({ mailer: testMailer({ store, transport: null }) });
    const run = await notifyWaitlist(d, springEvent.id);
    expect(run).toMatchObject({ sent: 0, skipped: 2 });
  });
});
