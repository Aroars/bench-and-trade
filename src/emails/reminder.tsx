import { Heading, Text } from "@react-email/components";
import { business } from "@/config/business";
import { emailCopy } from "@/config/email-copy";
import { DetailsTable, EmailShell, Paragraphs, styles } from "./shell";
import type { EmailContext } from "./types";
import { emailVars, fill } from "./vars";

export type ReminderWhen = "5d" | "1d";

function reminderVars(ctx: EmailContext, when: ReminderWhen) {
  return emailVars(ctx, { daysOut: when === "1d" ? "tomorrow" : "5 days" });
}

export function ReminderEmail({ ctx, when }: { ctx: EmailContext; when: ReminderWhen }) {
  const copy = emailCopy.reminder;
  const vars = reminderVars(ctx, when);
  const labels = emailCopy.labels;
  const wear = business.classNotes.whatToWear;
  const bring = business.classNotes.whatToBring;
  return (
    <EmailShell
      preview={when === "1d" ? copy.preview1d : copy.preview5d}
      heading={when === "1d" ? copy.heading1d : copy.heading5d}
      vars={vars}
    >
      <Text style={styles.p}>{fill(copy.greeting, vars)}</Text>
      <Text style={styles.note}>{fill(copy.excitement, vars)}</Text>
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
      {wear.length ? (
        <>
          <Heading as="h2" style={styles.h2}>
            {copy.wearHeading}
          </Heading>
          <ul style={styles.list}>
            {wear.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      {bring.length ? (
        <>
          <Heading as="h2" style={styles.h2}>
            {copy.bringHeading}
          </Heading>
          <ul style={styles.list}>
            {bring.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
      <Text style={styles.p}>{fill(copy.instructorLine, vars)}</Text>
      <Text style={styles.p}>{fill(when === "1d" ? copy.closing1d : copy.closing5d, vars)}</Text>
    </EmailShell>
  );
}

export function reminderSubject(ctx: EmailContext, when: ReminderWhen): string {
  const copy = emailCopy.reminder;
  return fill(when === "1d" ? copy.subject1d : copy.subject5d, reminderVars(ctx, when));
}
