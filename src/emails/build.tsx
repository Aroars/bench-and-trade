import { render } from "@react-email/components";
import type { ReactElement } from "react";
import type { EmailKind } from "@/config/email";
import { ConfirmationPaidEmail, confirmationPaidSubject } from "./confirmation-paid";
import { ConfirmationPendingEmail, confirmationPendingSubject } from "./confirmation-pending";
import { ReminderEmail, reminderSubject } from "./reminder";
import type { BuiltEmail, EmailContext } from "./types";
import { WaitlistEmail, waitlistSubject } from "./waitlist";
import { WaitlistNewClassEmail, waitlistNewClassSubject } from "./waitlist-new-class";

/** Picks the template and subject for a kind. */
export function emailFor(kind: EmailKind, ctx: EmailContext): { subject: string; element: ReactElement } {
  switch (kind) {
    case "confirmation_paid":
      return { subject: confirmationPaidSubject(ctx), element: <ConfirmationPaidEmail ctx={ctx} /> };
    case "confirmation_pending":
      return {
        subject: confirmationPendingSubject(ctx),
        element: <ConfirmationPendingEmail ctx={ctx} />,
      };
    case "waitlist":
      return { subject: waitlistSubject(ctx), element: <WaitlistEmail ctx={ctx} /> };
    case "reminder_5d":
      return { subject: reminderSubject(ctx, "5d"), element: <ReminderEmail ctx={ctx} when="5d" /> };
    case "reminder_1d":
      return { subject: reminderSubject(ctx, "1d"), element: <ReminderEmail ctx={ctx} when="1d" /> };
    case "waitlist_new_class":
      return { subject: waitlistNewClassSubject(ctx), element: <WaitlistNewClassEmail ctx={ctx} /> };
  }
}

/**
 * Plain-text rules on top of React Email's defaults: headings keep their case
 * and the details table reads as "Label: value" lines.
 */
const plainTextSelectors = [
  { selector: "table.hazard", format: "skip" },
  { selector: "h1", options: { uppercase: false } },
  { selector: "h2", options: { uppercase: false } },
  { selector: "table.details", format: "block" },
  { selector: "tr.detail-row", format: "block", options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
  { selector: "td.detail-label", format: "inlineSurround", options: { suffix: ": " } },
  { selector: "td.detail-value", format: "inline" },
];

/** Renders subject, HTML, and a plain-text twin. */
export async function buildEmail(kind: EmailKind, ctx: EmailContext): Promise<BuiltEmail> {
  const { subject, element } = emailFor(kind, ctx);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true, htmlToTextOptions: { selectors: plainTextSelectors } }),
  ]);
  return { subject, html, text };
}
