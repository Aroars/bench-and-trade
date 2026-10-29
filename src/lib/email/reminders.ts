/**
 * Daily reminder pass. Pure of Next and the database.
 * Finds classes whose Boise start date is exactly N days away for each
 * configured offset and emails every registration in a reminder status.
 * Reruns are safe: the mailer checks the log before every send.
 */
import { reminderOffsets, reminderRecipientStatuses, type EmailKind } from "@/config/email";
import type { BuiltEmail, EmailContext, EmailEvent, EmailRegistration } from "@/emails/types";
import { boiseDaysUntil } from "@/lib/boise-time";
import { pause, type Mailer, type SendOutcome } from "./mailer";

export type ReminderDeps = {
  now: Date;
  listEvents: () => Promise<EmailEvent[]>;
  listRecipients: (eventId: string, statuses: readonly string[]) => Promise<EmailRegistration[]>;
  build: (kind: EmailKind, ctx: EmailContext) => Promise<BuiltEmail>;
  mailer: Mailer;
  /** Defaults to reminderRecipientStatuses from config. */
  statuses?: readonly string[];
  /** Pause between sends. Tests pass 0. */
  pauseMs?: number;
};

export type Tally = {
  recipients: number;
  sent: number;
  skipped: number;
  failed: number;
  already: number;
};

export type ReminderEventResult = Tally & {
  eventId: string;
  slug: string;
  kind: EmailKind;
  daysOut: number;
};

export type ReminderRun = {
  ranAt: string;
  configured: boolean;
  events: ReminderEventResult[];
  totals: Tally;
};

export function emptyTally(): Tally {
  return { recipients: 0, sent: 0, skipped: 0, failed: 0, already: 0 };
}

export function addOutcome(tally: Tally, outcome: SendOutcome): void {
  tally.recipients += 1;
  if (outcome.status === "sent") tally.sent += 1;
  else if (outcome.status === "skipped") tally.skipped += 1;
  else if (outcome.status === "failed") tally.failed += 1;
  else tally.already += 1;
}

/** Which reminder, if any, an event is due for on this Boise calendar day. */
export function reminderDue(now: Date, event: EmailEvent): { kind: EmailKind; days: number } | null {
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const days = boiseDaysUntil(now, start);
  for (const offset of reminderOffsets) {
    if (days === offset.days) {
      return { kind: offset.kind, days };
    }
  }
  return null;
}

export async function runReminders(deps: ReminderDeps): Promise<ReminderRun> {
  const statuses = deps.statuses ?? reminderRecipientStatuses;
  const pauseMs = deps.pauseMs ?? 0;
  const events = await deps.listEvents();
  const results: ReminderEventResult[] = [];
  const totals = emptyTally();

  for (const event of events) {
    const due = reminderDue(deps.now, event);
    if (!due) {
      continue;
    }
    const tally: ReminderEventResult = {
      ...emptyTally(),
      eventId: event.id,
      slug: event.slug,
      kind: due.kind,
      daysOut: due.days,
    };
    const recipients = await deps.listRecipients(event.id, statuses);
    for (const registration of recipients) {
      if (!statuses.includes(registration.status)) {
        continue;
      }
      const ctx: EmailContext = { registration, event };
      const built = await deps.build(due.kind, ctx);
      const outcome = await deps.mailer.send({
        registrationId: registration.id,
        eventId: event.id,
        kind: due.kind,
        to: registration.parentEmail,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      addOutcome(tally, outcome);
      addOutcome(totals, outcome);
      if (outcome.status === "sent") {
        await pause(pauseMs);
      }
    }
    results.push(tally);
  }

  return {
    ranAt: deps.now.toISOString(),
    configured: deps.mailer.configured,
    events: results,
    totals,
  };
}
