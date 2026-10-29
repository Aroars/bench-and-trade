import { Heading, Text } from "@react-email/components";
import { emailCopy } from "@/config/email-copy";
import { DetailsTable, EmailShell, Paragraphs, styles } from "./shell";
import type { EmailContext } from "./types";
import { emailVars, fill } from "./vars";

export function ConfirmationPendingEmail({ ctx }: { ctx: EmailContext }) {
  const copy = emailCopy.confirmationPending;
  const vars = emailVars(ctx);
  const labels = emailCopy.labels;
  return (
    <EmailShell preview={copy.preview} heading={copy.heading} vars={vars}>
      <Text style={styles.p}>{fill(copy.greeting, vars)}</Text>
      <Paragraphs lines={copy.body} vars={vars} />
      <Heading as="h2" style={styles.h2}>
        {copy.detailsHeading}
      </Heading>
      <DetailsTable
        rows={[
          { label: labels.class, value: vars.classTitle },
          { label: labels.date, value: vars.dateLabel },
          { label: labels.time, value: vars.timeLabel },
          { label: labels.where, value: `${vars.venueName}, ${vars.address}` },
          { label: labels.kids, value: vars.kidNames },
          { label: labels.instructor, value: vars.instructor },
        ]}
      />
      {vars.amount ? <Text style={styles.note}>{fill(copy.amountLine, vars)}</Text> : null}
    </EmailShell>
  );
}

export function confirmationPendingSubject(ctx: EmailContext): string {
  return fill(emailCopy.confirmationPending.subject, emailVars(ctx));
}
