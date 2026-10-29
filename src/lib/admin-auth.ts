import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "bt_admin";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return false;
  }
  const left = digest(input);
  const right = digest(expected);
  return timingSafeEqual(left, right);
}

export function sessionToken(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set.");
  }
  return createHash("sha256").update(`bench-and-trade-admin-v1:${secret}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  if (!adminPasswordConfigured()) {
    return false;
  }
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) {
    return false;
  }
  const left = digest(value);
  const right = digest(sessionToken());
  return timingSafeEqual(left, right);
}

export function adminCookie() {
  return {
    name: COOKIE,
    value: sessionToken(),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
}
