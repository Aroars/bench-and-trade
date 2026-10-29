import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed opt-out links for waitlist emails.
 * The token is an HMAC of the lowercased email, so the link in a family's
 * email only works for that family. Reminders and confirmations do not carry
 * one; they are transactional.
 */

const SCOPE = "bench-and-trade-waitlist-unsubscribe-v1";

export function unsubscribeSecret(): string | null {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.ADMIN_SESSION_SECRET || null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function unsubscribeToken(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`${SCOPE}:${normalizeEmail(email)}`).digest("hex");
}

export function unsubscribeTokenValid(email: string, token: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    return false;
  }
  const expected = Buffer.from(unsubscribeToken(email, secret), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Returns null when no secret is set, so the email simply omits the link. */
export function unsubscribeUrl(email: string, siteOrigin: string, secret = unsubscribeSecret()): string | null {
  if (!secret) {
    return null;
  }
  const url = new URL("/api/email/unsubscribe", siteOrigin);
  url.searchParams.set("e", normalizeEmail(email));
  url.searchParams.set("t", unsubscribeToken(email, secret));
  return url.toString();
}

export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
