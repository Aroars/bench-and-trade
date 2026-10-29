import { business, formatDollars } from "@/config/business";
import { formatBoiseDate, formatBoiseTimeRange } from "@/lib/boise-time";
import type { EmailContext } from "./types";

export type EmailVars = Record<string, string>;

/** "Ada", "Ada and Sam", or "Ada, Sam, and Lee". */
export function joinNames(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return "your kid";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

/** "Sawdust & Slice" from "Sawdust & Slice: Saturday Shop Class and Personal Pizza". */
export function shortClassName(title: string): string {
  const head = title.split(":")[0]?.trim();
  return head || title;
}

export function emailVars(ctx: EmailContext, extra: EmailVars = {}): EmailVars {
  const start = new Date(ctx.event.startsAt);
  const end = new Date(ctx.event.endsAt);
  const plural = ctx.registration.studentNames.filter((name) => name.trim()).length > 1;
  return {
    parentName: ctx.registration.parentName.trim() || "there",
    kidNames: joinNames(ctx.registration.studentNames),
    hasHave: plural ? "have" : "has",
    isAre: plural ? "are" : "is",
    className: shortClassName(ctx.event.title),
    classTitle: ctx.event.title,
    dateLabel: formatBoiseDate(start),
    timeLabel: formatBoiseTimeRange(start, end),
    venueName: ctx.event.locationName,
    address: ctx.event.locationAddress,
    instructor: business.instructorName,
    amount:
      ctx.registration.amountCents == null ? "" : formatDollars(ctx.registration.amountCents),
    businessName: business.name,
    contactEmail: business.contact.email,
    contactPhone: business.contact.phoneDisplay,
    signupUrl: ctx.signupUrl ?? "",
    unsubscribeUrl: ctx.unsubscribeUrl ?? "",
    ...extra,
  };
}

/** Replace {tokens}. Unknown tokens are left alone so a typo is visible. */
export function fill(template: string, vars: EmailVars): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}
