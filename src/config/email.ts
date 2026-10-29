/**
 * Email settings that are not words. Words live in src/config/email-copy.ts.
 */

/**
 * Registration statuses that get the 5-day and day-before reminders.
 * Drop "pending_payment" here for paid-only reminders.
 * "pending" (an open card hold), "waitlist", "expired", "failed", and
 * "cancelled" never get a reminder.
 */
export const reminderRecipientStatuses = ["paid", "processing", "pending_payment"] as const;

/** Days before class start, in Boise calendar days, that a reminder goes out. */
export const reminderOffsets = [
  { days: 5, kind: "reminder_5d" },
  { days: 1, kind: "reminder_1d" },
] as const;

/**
 * Pause between sends when a job emails many families.
 * Resend allows 2 requests per second by default, so 600 ms keeps a margin.
 */
export const sendPauseMs = 600;

export const defaultFromAddress = "Bench & Trade <classes@send.benchandtrade.com>";

export function emailFromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || defaultFromAddress;
}

export function emailReplyTo(): string | undefined {
  const value = process.env.EMAIL_REPLY_TO?.trim();
  return value ? value : undefined;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type EmailKind =
  | "confirmation_paid"
  | "confirmation_pending"
  | "waitlist"
  | "reminder_5d"
  | "reminder_1d"
  | "waitlist_new_class";

export const emailKinds: readonly EmailKind[] = [
  "confirmation_paid",
  "confirmation_pending",
  "waitlist",
  "reminder_5d",
  "reminder_1d",
  "waitlist_new_class",
];

export type EmailLogStatus = "sent" | "skipped" | "failed";
