import { Button, Heading, Section, Text } from "@react-email/components";
import { emailCopy } from "@/config/email-copy";
import { DetailsTable, EmailShell, Paragraphs, styles } from "./shell";
import type { EmailContext } from "./types";
import { emailVars, fill } from "./vars";

export function WaitlistNewClassEmail({ ctx }: { ctx: EmailContext }) {
  const copy = emailCopy.waitlistNewClass;
  const vars = emailVars(ctx);
  const labels = emailCopy.labels;
  return (
    <EmailShell
      preview={copy.preview}
      heading={copy.heading}
      vars={vars}
      unsubscribeUrl={ctx.unsubscribeUrl}
    >
      <Text style={styles.p}>{fill(copy.greeting, vars)}</Text>
      <Paragraphs lines={copy.body} vars={vars} />
      {ctx.signupUrl ? (
        <Section style={{ margin: "4px 0 22px" }}>
          <Button href={ctx.signupUrl} style={styles.button}>
            {copy.button}
          </Button>
        </Section>
      ) : null}
      <Heading as="h2" style={styles.h2}>
        {copy.detailsHeading}
      </Heading>
      <DetailsTable
        rows={[
          { label: labels.class, value: vars.classTitle },
          { label: labels.date, value: vars.dateLabel },
          { label: labels.time, value: vars.timeLabel },
          { label: labels.where, value: `${vars.venueName}, ${vars.address}` },
          { label: labels.instructor, value: vars.instructor },
        ]}
      />
      {ctx.signupUrl ? (
        <Text style={styles.footerText}>
          Sign-up link: <a href={ctx.signupUrl} style={styles.link}>{ctx.signupUrl}</a>
        </Text>
      ) : null}
    </EmailShell>
  );
}

export function waitlistNewClassSubject(ctx: EmailContext): string {
  return fill(emailCopy.waitlistNewClass.subject, emailVars(ctx));
}
