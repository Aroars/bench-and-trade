/**
 * The send path. Pure of Next and the database so tests can drive it.
 * Production wiring lives in src/lib/email/index.ts.
 *
 * Rules:
 * - Never throws. A sign-up or webhook must not fail because email did.
 * - Every send is checked against the log first and recorded after.
 * - Without a transport (no RESEND_API_KEY) the send is logged as skipped.
 */
import type { EmailKind, EmailLogStatus } from "@/config/email";

export type EmailLogKey = {
  registrationId: string;
  kind: EmailKind;
  /** The class the email is about. For waitlist_new_class, the new class. */
  eventId: string;
};

export type EmailLogRow = EmailLogKey & {
  status: EmailLogStatus;
  resendId: string | null;
  error: string | null;
};

export interface EmailStore {
  findLog(key: EmailLogKey): Promise<EmailLogRow | null>;
  /** Insert or replace the row for this key. */
  recordLog(row: EmailLogRow): Promise<void>;
}

export type OutgoingMessage = {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  idempotencyKey: string;
};

export interface EmailTransport {
  /** Resolves with the provider id. Rejects on any failure. */
  send(message: OutgoingMessage): Promise<{ id: string }>;
}

export type SendJob = EmailLogKey & {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendOutcome =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string }
  | { status: "already"; previous: EmailLogStatus };

export type Mailer = {
  send(job: SendJob): Promise<SendOutcome>;
  configured: boolean;
};

export type MailerOptions = {
  store: EmailStore;
  /** null when RESEND_API_KEY is unset. */
  transport: EmailTransport | null;
  from: string;
  replyTo?: string;
  log?: (line: string) => void;
};

export function idempotencyKeyFor(key: EmailLogKey): string {
  return key.kind === "waitlist_new_class"
    ? `${key.kind}:${key.registrationId}:${key.eventId}`
    : `${key.kind}:${key.registrationId}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

export function createMailer(options: MailerOptions): Mailer {
  const log = options.log ?? ((line: string) => console.log(line));
  const key = (job: EmailLogKey): EmailLogKey => ({
    registrationId: job.registrationId,
    kind: job.kind,
    eventId: job.eventId,
  });

  async function record(job: EmailLogKey, status: EmailLogStatus, resendId: string | null, error: string | null) {
    try {
      await options.store.recordLog({ ...key(job), status, resendId, error });
    } catch (storeError) {
      log(`email_log_failed kind=${job.kind} registration=${job.registrationId} ${errorText(storeError)}`);
    }
  }

  return {
    configured: options.transport !== null,
    async send(job) {
      try {
        const existing = await options.store.findLog(key(job));
        if (existing && existing.status !== "failed") {
          return { status: "already", previous: existing.status };
        }

        if (!options.transport) {
          log(`email skipped kind=${job.kind} registration=${job.registrationId} reason=RESEND_API_KEY unset`);
          await record(job, "skipped", null, "RESEND_API_KEY unset");
          return { status: "skipped", reason: "RESEND_API_KEY unset" };
        }

        try {
          const result = await options.transport.send({
            to: job.to,
            from: options.from,
            replyTo: options.replyTo,
            subject: job.subject,
            html: job.html,
            text: job.text,
            headers: job.headers,
            idempotencyKey: idempotencyKeyFor(job),
          });
          await record(job, "sent", result.id, null);
          return { status: "sent", id: result.id };
        } catch (sendError) {
          const reason = errorText(sendError);
          log(`email_failed kind=${job.kind} registration=${job.registrationId} ${reason}`);
          await record(job, "failed", null, reason);
          return { status: "failed", reason };
        }
      } catch (error) {
        const reason = errorText(error);
        log(`email_failed kind=${job.kind} registration=${job.registrationId} ${reason}`);
        return { status: "failed", reason };
      }
    },
  };
}

export function pause(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
