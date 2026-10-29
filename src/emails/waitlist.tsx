import { Text } from "@react-email/components";
import { emailCopy } from "@/config/email-copy";
import { EmailShell, Paragraphs, styles } from "./shell";
import type { EmailContext } from "./types";
import { emailVars, fill } from "./vars";

export function WaitlistEmail({ ctx }: { ctx: EmailContext }) {
  const copy = emailCopy.waitlist;
  const vars = emailVars(ctx);
  return (
    <EmailShell
      preview={copy.preview}
      heading={copy.heading}
      vars={vars}
      unsubscribeUrl={ctx.unsubscribeUrl}
    >
      <Text style={styles.p}>{fill(copy.greeting, vars)}</Text>
      <Paragraphs lines={copy.body} vars={vars} />
    </EmailShell>
  );
}

export function waitlistSubject(ctx: EmailContext): string {
  return fill(emailCopy.waitlist.subject, emailVars(ctx));
}
