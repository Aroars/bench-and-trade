import "server-only";
import { siteUrl } from "@/config/business";

export function requestOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return siteUrl();
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (!host) {
    return siteUrl();
  }
  return `${proto}://${host}`;
}
