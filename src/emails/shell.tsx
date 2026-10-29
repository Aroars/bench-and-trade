import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailCopy } from "@/config/email-copy";
import { fill, type EmailVars } from "./vars";

/** Bench & Trade tokens from DESIGN.md. Inline styles only, for email clients. */
export const tone = {
  charcoal: "#141210",
  paper: "#fffdf6",
  yellow: "#FFD100",
  red: "#D7262B",
  muted: "#3a342c",
  rule: "#141210",
};

const bodyFont = '"Source Sans 3", "Segoe UI", Arial, Helvetica, sans-serif';
const headingFont = 'Rowdies, "Arial Black", Arial, Helvetica, sans-serif';

export const styles = {
  body: {
    margin: 0,
    padding: "24px 12px",
    backgroundColor: tone.paper,
    fontFamily: bodyFont,
    color: tone.charcoal,
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: tone.paper,
    border: `3px solid ${tone.charcoal}`,
  },
  header: {
    backgroundColor: tone.charcoal,
    padding: "18px 24px",
  },
  wordmark: {
    margin: 0,
    color: tone.yellow,
    fontFamily: headingFont,
    fontSize: "26px",
    lineHeight: "30px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  tagline: {
    margin: "2px 0 0",
    color: tone.paper,
    fontSize: "14px",
    lineHeight: "20px",
  },
  hazard: {
    height: "8px",
    backgroundColor: tone.yellow,
    borderTop: `2px solid ${tone.charcoal}`,
    borderBottom: `2px solid ${tone.charcoal}`,
  },
  content: {
    padding: "24px 24px 8px",
  },
  h1: {
    margin: "0 0 16px",
    fontFamily: headingFont,
    fontSize: "28px",
    lineHeight: "32px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: tone.charcoal,
  },
  h2: {
    margin: "20px 0 8px",
    fontFamily: headingFont,
    fontSize: "18px",
    lineHeight: "24px",
    fontWeight: 700,
    color: tone.charcoal,
  },
  p: {
    margin: "0 0 14px",
    fontSize: "17px",
    lineHeight: "26px",
    color: tone.charcoal,
  },
  note: {
    margin: "0 0 14px",
    padding: "12px 14px",
    backgroundColor: tone.yellow,
    border: `3px solid ${tone.charcoal}`,
    fontSize: "17px",
    lineHeight: "26px",
    color: tone.charcoal,
  },
  list: {
    margin: "0 0 14px",
    paddingLeft: "22px",
    fontSize: "17px",
    lineHeight: "26px",
    color: tone.charcoal,
  },
  detailsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    margin: "0 0 18px",
    borderTop: `3px solid ${tone.charcoal}`,
  },
  detailLabel: {
    padding: "8px 10px 8px 0",
    borderBottom: `1px solid ${tone.charcoal}`,
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    verticalAlign: "top" as const,
    width: "110px",
    color: tone.muted,
  },
  detailValue: {
    padding: "8px 0",
    borderBottom: `1px solid ${tone.charcoal}`,
    fontSize: "17px",
    lineHeight: "24px",
    verticalAlign: "top" as const,
    color: tone.charcoal,
  },
  button: {
    display: "inline-block",
    backgroundColor: tone.red,
    color: tone.paper,
    border: `3px solid ${tone.charcoal}`,
    padding: "14px 22px",
    fontSize: "15px",
    lineHeight: "16px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    textDecoration: "none",
  },
  hr: {
    borderColor: tone.charcoal,
    borderWidth: "2px 0 0",
    margin: "8px 0 16px",
  },
  footer: {
    padding: "0 24px 24px",
  },
  footerText: {
    margin: "0 0 8px",
    fontSize: "14px",
    lineHeight: "20px",
    color: tone.muted,
  },
  link: {
    color: tone.charcoal,
    textDecoration: "underline",
  },
};

export function DetailsTable({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <table
      className="details"
      role="presentation"
      style={styles.detailsTable}
      cellPadding={0}
      cellSpacing={0}
    >
      <tbody>
        {rows
          .filter((row) => row.value)
          .map((row) => (
            <tr key={row.label} className="detail-row">
              <td className="detail-label" style={styles.detailLabel}>
                {row.label}
              </td>
              <td className="detail-value" style={styles.detailValue}>
                {row.value}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

export function Paragraphs({ lines, vars }: { lines: readonly string[]; vars: EmailVars }) {
  return (
    <>
      {lines.map((line) => (
        <Text key={line} style={styles.p}>
          {fill(line, vars)}
        </Text>
      ))}
    </>
  );
}

export function EmailShell({
  preview,
  heading,
  vars,
  unsubscribeUrl,
  children,
}: {
  preview: string;
  heading: string;
  vars: EmailVars;
  unsubscribeUrl?: string;
  children: ReactNode;
}) {
  const { header, footer } = emailCopy;
  return (
    <Html lang="en">
      <Head />
      <Preview>{fill(preview, vars)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.wordmark}>{header.wordmark}</Text>
            <Text style={styles.tagline}>{header.tagline}</Text>
          </Section>
          <Section className="hazard" style={styles.hazard} />
          <Section style={styles.content}>
            <Heading as="h1" style={styles.h1}>
              {fill(heading, vars)}
            </Heading>
            {children}
            <Text style={styles.p}>
              {footer.signoff}
              <br />
              {fill(footer.signature, vars)}
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Hr style={styles.hr} />
            <Text style={styles.footerText}>{fill(footer.contactLine, vars)}</Text>
            {unsubscribeUrl ? (
              <Text style={styles.footerText}>
                {footer.unsubscribeLine}{" "}
                <Link href={unsubscribeUrl} style={styles.link}>
                  {footer.unsubscribeLink}
                </Link>
                .
              </Text>
            ) : null}
            <Text style={styles.footerText}>{fill(footer.legal, vars)}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
