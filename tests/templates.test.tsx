import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { emailKinds } from "@/config/email";
import { buildEmail } from "@/emails/build";
import type { EmailContext } from "@/emails/types";
import { fill, joinNames, shortClassName } from "@/emails/vars";
import { pilotEvent, registration } from "./helpers";

const previewDir = process.env.EMAIL_PREVIEW_DIR;

function context(kind: string): EmailContext {
  const base = registration({
    parentName: "Ada Parent",
    parentEmail: "ada@example.com",
    studentNames: ["Sam", "Lee"],
    amountCents: 8000,
    status: kind === "waitlist" ? "waitlist" : kind === "confirmation_pending" ? "pending_payment" : "paid",
  });
  return {
    registration: base,
    event: pilotEvent,
    signupUrl: kind === "waitlist_new_class" ? "https://benchandtrade.com/events/sawdust-and-slice" : undefined,
    unsubscribeUrl:
      kind === "waitlist" || kind === "waitlist_new_class"
        ? "https://benchandtrade.com/api/email/unsubscribe?e=ada%40example.com&t=abc"
        : undefined,
  };
}

describe("templates", () => {
  test.each(emailKinds)("%s renders html and text", async (kind) => {
    const built = await buildEmail(kind, context(kind));
    expect(built.subject.length).toBeGreaterThan(5);
    expect(built.subject).not.toContain("{");
    expect(built.html).toContain("<!DOCTYPE html");
    expect(built.html).toContain("Ada Parent");
    expect(built.html).toContain("Saturday, November 14, 2026");
    if (kind !== "waitlist") {
      expect(built.html).toContain("10:00 AM to 12:00 PM MST");
    }
    expect(built.html).toContain("2431 W Fairview Ave");
    expect(built.html).toContain("hello@benchandtrade.com");
    expect(built.html).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(built.text).toContain("Ada Parent");
    expect(built.text).not.toContain("<");
    expect(built.text).not.toMatch(/\{[a-zA-Z]+\}/);
    if (previewDir) {
      mkdirSync(previewDir, { recursive: true });
      writeFileSync(join(previewDir, `${kind}.html`), built.html);
      writeFileSync(join(previewDir, `${kind}.txt`), `Subject: ${built.subject}\n\n${built.text}`);
    }
  });

  test("the paid confirmation names the kids and the amount", async () => {
    const built = await buildEmail("confirmation_paid", context("confirmation_paid"));
    expect(built.subject).toBe("You're signed up: Sawdust & Slice, Saturday, November 14, 2026");
    expect(built.text).toContain("Sam and Lee");
    expect(built.text).toContain("Paid: $80");
    expect(built.text).toContain("You are signed up.");
    expect(built.text).toContain("Date: Saturday, November 14, 2026");
    expect(built.text).toContain("Kids: Sam and Lee");
  });

  test("the held-spot confirmation says nothing was charged", async () => {
    const built = await buildEmail("confirmation_pending", context("confirmation_pending"));
    expect(built.text).toContain("Nothing has been charged");
    expect(built.text).toContain("payment link");
  });

  test("the reminders carry the warm note, instructor, and what to wear", async () => {
    const five = await buildEmail("reminder_5d", context("reminder_5d"));
    expect(five.text).toContain("We cannot wait to have Sam and Lee");
    expect(five.text).toContain("Closed-toe shoes");
    expect(five.text).toContain("What to bring");
    expect(five.text).toContain("[INSTRUCTOR NAME]");
    const one = await buildEmail("reminder_1d", context("reminder_1d"));
    expect(one.subject).toBe("Sawdust & Slice is tomorrow");
  });

  test("waitlist emails carry the opt-out link and the others do not", async () => {
    const wait = await buildEmail("waitlist", context("waitlist"));
    expect(wait.html).toContain("/api/email/unsubscribe");
    const paid = await buildEmail("confirmation_paid", context("confirmation_paid"));
    expect(paid.html).not.toContain("unsubscribe");
  });

  test("the new-class email links to the class", async () => {
    const built = await buildEmail("waitlist_new_class", context("waitlist_new_class"));
    expect(built.html).toContain('href="https://benchandtrade.com/events/sawdust-and-slice"');
    expect(built.text).toContain("https://benchandtrade.com/events/sawdust-and-slice");
  });
});

describe("copy helpers", () => {
  test("joinNames", () => {
    expect(joinNames([])).toBe("your kid");
    expect(joinNames(["Ada"])).toBe("Ada");
    expect(joinNames(["Ada", "Sam"])).toBe("Ada and Sam");
    expect(joinNames(["Ada", "Sam", "Lee"])).toBe("Ada, Sam, and Lee");
  });

  test("shortClassName and fill", () => {
    expect(shortClassName("Sawdust & Slice: Saturday Shop Class")).toBe("Sawdust & Slice");
    expect(shortClassName("Plain")).toBe("Plain");
    expect(fill("Hi {parentName}, {missing}", { parentName: "Ada" })).toBe("Hi Ada, {missing}");
  });
});
