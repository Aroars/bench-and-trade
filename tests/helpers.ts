import type { EmailEvent, EmailRegistration } from "@/emails/types";
import {
  createMailer,
  type EmailLogKey,
  type EmailLogRow,
  type EmailStore,
  type EmailTransport,
  type Mailer,
  type OutgoingMessage,
} from "@/lib/email/mailer";

export const pilotEvent: EmailEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "sawdust-and-slice",
  title: "Sawdust & Slice: Saturday Shop Class and Personal Pizza",
  startsAt: "2026-11-14T17:00:00.000Z",
  endsAt: "2026-11-14T19:00:00.000Z",
  locationName: "Casanova Pizzeria",
  locationAddress: "2431 W Fairview Ave, Boise, ID 83702",
};

export const springEvent: EmailEvent = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "birdhouse-and-bagels",
  title: "Birdhouse & Bagels: Spring Shop Class",
  startsAt: "2027-03-15T16:00:00.000Z",
  endsAt: "2027-03-15T18:00:00.000Z",
  locationName: "Casanova Pizzeria",
  locationAddress: "2431 W Fairview Ave, Boise, ID 83702",
};

let counter = 0;

export function registration(overrides: Partial<EmailRegistration> = {}): EmailRegistration {
  counter += 1;
  const n = String(counter).padStart(12, "0");
  return {
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${n}`,
    eventId: pilotEvent.id,
    status: "paid",
    parentName: `Parent ${counter}`,
    parentEmail: `parent${counter}@example.com`,
    amountCents: 8000,
    studentNames: [`Kid ${counter}A`, `Kid ${counter}B`],
    ...overrides,
  };
}

function logKey(key: EmailLogKey): string {
  return key.kind === "waitlist_new_class"
    ? `${key.registrationId}|${key.kind}|${key.eventId}`
    : `${key.registrationId}|${key.kind}`;
}

export function memoryStore(): EmailStore & { rows: Map<string, EmailLogRow> } {
  const rows = new Map<string, EmailLogRow>();
  return {
    rows,
    async findLog(key) {
      return rows.get(logKey(key)) ?? null;
    },
    async recordLog(row) {
      rows.set(logKey(row), row);
    },
  };
}

export function fakeTransport(options: { failFor?: (message: OutgoingMessage) => boolean } = {}): EmailTransport & {
  sent: OutgoingMessage[];
} {
  const sent: OutgoingMessage[] = [];
  return {
    sent,
    async send(message) {
      if (options.failFor?.(message)) {
        throw new Error("boom");
      }
      sent.push(message);
      return { id: `re_${sent.length}` };
    },
  };
}

export function testMailer(input: {
  store?: EmailStore;
  transport?: EmailTransport | null;
  logLines?: string[];
}): Mailer {
  const lines = input.logLines ?? [];
  return createMailer({
    store: input.store ?? memoryStore(),
    transport: input.transport === undefined ? fakeTransport() : input.transport,
    from: "Bench & Trade <classes@send.benchandtrade.com>",
    replyTo: undefined,
    log: (line) => lines.push(line),
  });
}
