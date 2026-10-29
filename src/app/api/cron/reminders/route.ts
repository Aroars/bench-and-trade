import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { runReminderJob } from "@/lib/email";

/** Many families times a polite pause between sends can pass ten seconds. */
export const maxDuration = 300;

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) {
    return false;
  }
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Vercel Cron calls this once a day (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Anyone else gets 401.
 * Safe to call again by hand: the email log stops repeats.
 */
export async function GET(request: Request) {
  await connection();

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return Response.json({ error: "Database is not configured." }, { status: 503 });
  }

  try {
    const run = await runReminderJob(new Date());
    console.log(
      `reminders ran=${run.ranAt} events=${run.events.length} sent=${run.totals.sent} skipped=${run.totals.skipped} failed=${run.totals.failed} already=${run.totals.already}`,
    );
    return Response.json(run);
  } catch (error) {
    console.error("reminders_failed", error instanceof Error ? error.message : "error");
    return Response.json({ error: "Reminder run failed." }, { status: 500 });
  }
}
