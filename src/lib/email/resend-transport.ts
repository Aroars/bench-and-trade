import { Resend } from "resend";
import type { EmailTransport, OutgoingMessage } from "./mailer";

/** Wraps the official SDK so the mailer only sees send-or-throw. */
export function createResendTransport(apiKey: string): EmailTransport {
  const client = new Resend(apiKey);
  return {
    async send(message: OutgoingMessage) {
      const { data, error } = await client.emails.send(
        {
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
        },
        { idempotencyKey: message.idempotencyKey },
      );
      if (error) {
        throw new Error(`${error.name}: ${error.message}`);
      }
      if (!data?.id) {
        throw new Error("Resend returned no id.");
      }
      return { id: data.id };
    },
  };
}
