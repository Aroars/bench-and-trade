import { connection } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { isDbConfigured } from "@/lib/db";
import { sendWaitlistNewClassEmail } from "@/lib/email";

/** Many families times a polite pause between sends can pass ten seconds. */
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The confirm step of "notify the waitlist" on /admin.
 * The page shows the count first. This route only runs after the teacher
 * presses the send button, and only with the admin cookie.
 */
export async function POST(request: Request) {
  await connection();
  const back = new URL("/admin", request.url);

  if (!(await isAdmin())) {
    return new Response("Sign in required.", { status: 401 });
  }
  if (!isDbConfigured()) {
    return new Response("Database is not configured.", { status: 503 });
  }

  const form = await request.formData();
  const eventId = String(form.get("event_id") ?? "");
  const confirmed = form.get("confirm") === "1";
  if (!UUID.test(eventId)) {
    back.searchParams.set("notify_error", "event");
    return Response.redirect(back, 303);
  }
  if (!confirmed) {
    back.searchParams.set("notify", eventId);
    return Response.redirect(back, 303);
  }

  try {
    const run = await sendWaitlistNewClassEmail(eventId);
    if (!run) {
      back.searchParams.set("notify_error", "event");
      return Response.redirect(back, 303);
    }
    back.searchParams.set("notified", eventId);
    back.searchParams.set("sent", String(run.sent));
    back.searchParams.set("skipped", String(run.skipped));
    back.searchParams.set("failed", String(run.failed));
    back.searchParams.set("already", String(run.already));
    return Response.redirect(back, 303);
  } catch (error) {
    console.error("waitlist_notify_failed", error instanceof Error ? error.message : "error");
    back.searchParams.set("notify_error", "send");
    return Response.redirect(back, 303);
  }
}
