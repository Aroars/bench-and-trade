import { connection } from "next/server";
import { business } from "@/config/business";
import { emailCopy } from "@/config/email-copy";
import { isDbConfigured } from "@/lib/db";
import { recordWaitlistOptOut } from "@/lib/email";
import {
  normalizeEmail,
  unsubscribeSecret,
  unsubscribeTokenValid,
} from "@/lib/email/unsubscribe";

/**
 * The opt-out link in waitlist emails.
 * GET shows a one-button confirmation. POST records the opt-out. A mail
 * client's one-click unsubscribe (RFC 8058) also POSTs here.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · ${escapeHtml(business.name)}</title>
<style>
  body { margin: 0; background: #fffdf6; color: #141210; font-family: "Source Sans 3", "Segoe UI", Arial, sans-serif; }
  main { max-width: 36rem; margin: 0 auto; padding: 3rem 6vw; }
  h1 { font-family: Rowdies, "Arial Black", Arial, sans-serif; font-size: 2rem; letter-spacing: -0.02em; margin: 0 0 1rem; }
  p { font-size: 1.1rem; line-height: 1.55; }
  button { font: 700 0.9rem/1 "Source Sans 3", Arial, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; background: #D7262B; color: #fffdf6; border: 3px solid #141210; box-shadow: 4px 4px 0 #141210; padding: 1rem 1.5rem; cursor: pointer; }
  a { color: #141210; }
</style>
</head>
<body>
<header style="background:#141210;color:#FFD100;padding:1rem 6vw;font-family:Rowdies,'Arial Black',Arial,sans-serif;font-size:1.4rem">${escapeHtml(business.name)}</header>
<main>${body}</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function readParams(url: URL): { email: string; token: string } {
  return {
    email: normalizeEmail(url.searchParams.get("e") ?? ""),
    token: url.searchParams.get("t") ?? "",
  };
}

function invalid(): Response {
  return page(
    "Link did not work",
    `<h1>That link did not work.</h1>
     <p>It may have been cut off by your mail app. Reply to any email from us, or write to
     <a href="mailto:${escapeHtml(business.contact.email)}">${escapeHtml(business.contact.email)}</a>,
     and we will take you off the list by hand.</p>`,
    400,
  );
}

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const { email, token } = readParams(url);
  const secret = unsubscribeSecret();
  if (!secret || !email || !unsubscribeTokenValid(email, token, secret)) {
    return invalid();
  }
  return page(
    "Stop waitlist emails",
    `<h1>Stop waitlist emails?</h1>
     <p>We will stop emailing <strong>${escapeHtml(email)}</strong> when a new class opens.
     Confirmations and reminders for a class you are already signed up for still arrive.</p>
     <form method="post" action="${escapeHtml(url.pathname + url.search)}">
       <button type="submit">Stop waitlist emails</button>
     </form>`,
  );
}

export async function POST(request: Request) {
  await connection();
  const url = new URL(request.url);
  const { email, token } = readParams(url);
  const secret = unsubscribeSecret();
  if (!secret || !email || !unsubscribeTokenValid(email, token, secret)) {
    return invalid();
  }
  if (!isDbConfigured()) {
    return page(
      "Not saved",
      `<h1>We could not save that.</h1><p>Write to
       <a href="mailto:${escapeHtml(business.contact.email)}">${escapeHtml(business.contact.email)}</a>
       and we will take you off the list by hand.</p>`,
      503,
    );
  }
  try {
    await recordWaitlistOptOut(email);
  } catch (error) {
    console.error("unsubscribe_failed", error instanceof Error ? error.message : "error");
    return page(
      "Not saved",
      `<h1>We could not save that.</h1><p>Try the link again in a minute, or write to
       <a href="mailto:${escapeHtml(business.contact.email)}">${escapeHtml(business.contact.email)}</a>.</p>`,
      500,
    );
  }
  return page(
    "Done",
    `<h1>Done.</h1><p>${escapeHtml(emailCopy.footer.unsubscribeDone)}</p>
     <p><a href="/">Back to ${escapeHtml(business.name)}</a></p>`,
  );
}
