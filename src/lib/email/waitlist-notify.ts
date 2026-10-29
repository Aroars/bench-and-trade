/**
 * "A new class opened" for everyone on the waitlist. Pure of Next and the
 * database. The admin picks the new class, sees the count, confirms, sends.
 * Nothing here runs on its own when an event is inserted.
 */
import type { EmailKind } from "@/config/email";
import type { BuiltEmail, EmailContext, EmailEvent, EmailRegistration } from "@/emails/types";
import { pause, type Mailer } from "./mailer";
import { addOutcome, emptyTally, type Tally } from "./reminders";
import { listUnsubscribeHeaders, normalizeEmail, unsubscribeUrl } from "./unsubscribe";

export type WaitlistNotifyDeps = {
  getEvent: (eventId: string) => Promise<EmailEvent | null>;
  /** Every registration with status waitlist, any class. */
  listWaitlist: () => Promise<EmailRegistration[]>;
  listOptOuts: () => Promise<string[]>;
  /** Registration ids already logged sent or skipped for this new class. */
  listNotified: (eventId: string) => Promise<string[]>;
  build: (kind: EmailKind, ctx: EmailContext) => Promise<BuiltEmail>;
  mailer: Mailer;
  siteOrigin: string;
  /** Overrides the env-derived secret in tests. */
  unsubscribeSecret?: string | null;
  pauseMs?: number;
};

export type WaitlistSelection = {
  recipients: EmailRegistration[];
  /** Second and later sign-ups from an email already in recipients. */
  duplicates: EmailRegistration[];
  optedOut: number;
  sameClass: number;
};

/**
 * One email per family. Skips sign-ups for the new class itself, anyone who
 * opted out, and repeats of the same address.
 */
export function selectWaitlistRecipients(input: {
  target: EmailEvent;
  waitlist: EmailRegistration[];
  optOuts: string[];
}): WaitlistSelection {
  const optOut = new Set(input.optOuts.map(normalizeEmail));
  const seen = new Set<string>();
  const selection: WaitlistSelection = { recipients: [], duplicates: [], optedOut: 0, sameClass: 0 };
  for (const registration of input.waitlist) {
    if (registration.status !== "waitlist") {
      continue;
    }
    if (registration.eventId === input.target.id) {
      selection.sameClass += 1;
      continue;
    }
    const email = normalizeEmail(registration.parentEmail);
    if (optOut.has(email)) {
      selection.optedOut += 1;
      continue;
    }
    if (seen.has(email)) {
      selection.duplicates.push(registration);
      continue;
    }
    seen.add(email);
    selection.recipients.push(registration);
  }
  return selection;
}

export type WaitlistPreview = {
  event: EmailEvent;
  count: number;
  alreadyNotified: number;
  emails: string[];
  optedOut: number;
  duplicates: number;
};

export async function previewWaitlistNotify(
  deps: WaitlistNotifyDeps,
  eventId: string,
): Promise<WaitlistPreview | null> {
  const event = await deps.getEvent(eventId);
  if (!event) {
    return null;
  }
  const [waitlist, optOuts, notified] = await Promise.all([
    deps.listWaitlist(),
    deps.listOptOuts(),
    deps.listNotified(eventId),
  ]);
  const selection = selectWaitlistRecipients({ target: event, waitlist, optOuts });
  const done = new Set(notified);
  const pending = selection.recipients.filter((registration) => !done.has(registration.id));
  return {
    event,
    count: pending.length,
    alreadyNotified: selection.recipients.length - pending.length,
    emails: pending.map((registration) => registration.parentEmail),
    optedOut: selection.optedOut,
    duplicates: selection.duplicates.length,
  };
}

export type WaitlistNotifyRun = Tally & {
  event: EmailEvent;
  duplicates: number;
  optedOut: number;
};

export async function notifyWaitlist(
  deps: WaitlistNotifyDeps,
  eventId: string,
): Promise<WaitlistNotifyRun | null> {
  const event = await deps.getEvent(eventId);
  if (!event) {
    return null;
  }
  const [waitlist, optOuts] = await Promise.all([deps.listWaitlist(), deps.listOptOuts()]);
  const selection = selectWaitlistRecipients({ target: event, waitlist, optOuts });
  const tally: WaitlistNotifyRun = {
    ...emptyTally(),
    event,
    duplicates: selection.duplicates.length,
    optedOut: selection.optedOut,
  };
  const pauseMs = deps.pauseMs ?? 0;
  const signupUrl = new URL(`/events/${event.slug}`, deps.siteOrigin).toString();
  const secret = deps.unsubscribeSecret;

  for (const registration of selection.recipients) {
    const optOutUrl =
      secret === undefined
        ? unsubscribeUrl(registration.parentEmail, deps.siteOrigin)
        : unsubscribeUrl(registration.parentEmail, deps.siteOrigin, secret);
    const ctx: EmailContext = {
      registration,
      event,
      signupUrl,
      unsubscribeUrl: optOutUrl ?? undefined,
    };
    const built = await deps.build("waitlist_new_class", ctx);
    const outcome = await deps.mailer.send({
      registrationId: registration.id,
      eventId: event.id,
      kind: "waitlist_new_class",
      to: registration.parentEmail,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: optOutUrl ? listUnsubscribeHeaders(optOutUrl) : undefined,
    });
    addOutcome(tally, outcome);
    if (outcome.status === "sent") {
      await pause(pauseMs);
    }
  }

  return tally;
}
