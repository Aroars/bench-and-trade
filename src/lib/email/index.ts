import "server-only";
import { siteUrl } from "@/config/business";
import {
  emailFromAddress,
  emailReplyTo,
  isEmailConfigured,
  sendPauseMs,
  type EmailKind,
} from "@/config/email";
import { buildEmail } from "@/emails/build";
import type { EmailContext } from "@/emails/types";
import {
  addWaitlistOptOut,
  findEmailLog,
  getEventById,
  getRegistrationForEmail,
  listEvents,
  listNotifiedRegistrationIds,
  listRegistrationsForEmail,
  listWaitlistOptOuts,
  listWaitlistRegistrations,
  recordEmailLog,
} from "@/lib/db";
import { createMailer, type Mailer, type SendOutcome } from "./mailer";
import { runReminders, type ReminderRun } from "./reminders";
import { createResendTransport } from "./resend-transport";
import { listUnsubscribeHeaders, unsubscribeUrl } from "./unsubscribe";
import {
  notifyWaitlist,
  previewWaitlistNotify,
  type WaitlistNotifyDeps,
  type WaitlistNotifyRun,
  type WaitlistPreview,
} from "./waitlist-notify";

let cached: Mailer | null = null;
let cachedKey: string | undefined;

/** One mailer per process. Rebuilt if the key changes between calls. */
export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  if (!cached || cachedKey !== key) {
    cached = createMailer({
      store: { findLog: findEmailLog, recordLog: recordEmailLog },
      transport: isEmailConfigured() && key ? createResendTransport(key) : null,
      from: emailFromAddress(),
      replyTo: emailReplyTo(),
    });
    cachedKey = key;
  }
  return cached;
}

export type RegistrationEmailKind = Extract<
  EmailKind,
  "confirmation_paid" | "confirmation_pending" | "waitlist"
>;

/**
 * Sends one of the sign-up emails for a registration. Addressed only to the
 * parent email on the row. Never throws.
 */
export async function sendRegistrationEmail(
  kind: RegistrationEmailKind,
  registrationId: string,
): Promise<SendOutcome | null> {
  try {
    const found = await getRegistrationForEmail(registrationId);
    if (!found) {
      console.error(`email_registration_missing kind=${kind} registration=${registrationId}`);
      return null;
    }
    const { registration, event } = found;
    const origin = siteUrl();
    const optOutUrl = kind === "waitlist" ? unsubscribeUrl(registration.parentEmail, origin) : null;
    const ctx: EmailContext = {
      registration,
      event,
      unsubscribeUrl: optOutUrl ?? undefined,
    };
    const built = await buildEmail(kind, ctx);
    return await getMailer().send({
      registrationId: registration.id,
      eventId: event.id,
      kind,
      to: registration.parentEmail,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: optOutUrl ? listUnsubscribeHeaders(optOutUrl) : undefined,
    });
  } catch (error) {
    console.error(
      `email_send_failed kind=${kind} registration=${registrationId}`,
      error instanceof Error ? error.message : "error",
    );
    return null;
  }
}

export async function runReminderJob(now: Date = new Date()): Promise<ReminderRun> {
  return runReminders({
    now,
    listEvents,
    listRecipients: listRegistrationsForEmail,
    build: buildEmail,
    mailer: getMailer(),
    pauseMs: sendPauseMs,
  });
}

function waitlistDeps(): WaitlistNotifyDeps {
  return {
    getEvent: getEventById,
    listWaitlist: listWaitlistRegistrations,
    listOptOuts: listWaitlistOptOuts,
    listNotified: (eventId) => listNotifiedRegistrationIds(eventId, "waitlist_new_class"),
    build: buildEmail,
    mailer: getMailer(),
    siteOrigin: siteUrl(),
    pauseMs: sendPauseMs,
  };
}

export function previewWaitlistEmail(eventId: string): Promise<WaitlistPreview | null> {
  return previewWaitlistNotify(waitlistDeps(), eventId);
}

export function sendWaitlistNewClassEmail(eventId: string): Promise<WaitlistNotifyRun | null> {
  return notifyWaitlist(waitlistDeps(), eventId);
}

export async function recordWaitlistOptOut(email: string): Promise<void> {
  await addWaitlistOptOut(email);
}
