import type { Metadata } from "next";
import { Suspense } from "react";
import { business, formatDollars } from "@/config/business";
import { isEmailConfigured } from "@/config/email";
import type { EmailEvent } from "@/emails/types";
import { adminPasswordConfigured, isAdmin } from "@/lib/admin-auth";
import { formatBoiseDate, formatBoiseTimeRange } from "@/lib/boise-time";
import { isDbConfigured, listEvents, listRegistrations, type RegistrationRecord } from "@/lib/db";
import { previewWaitlistEmail } from "@/lib/email";
import type { WaitlistPreview } from "@/lib/email/waitlist-notify";

export const metadata: Metadata = {
  title: "Registration list",
  robots: { index: false, follow: false },
};

const toppingLabel = new Map(business.toppings.map((topping) => [topping.value, topping.label]));

type AdminParams = {
  error?: string;
  notify?: string;
  notified?: string;
  notify_error?: string;
  sent?: string;
  skipped?: string;
  failed?: string;
  already?: string;
};

export default function AdminPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  return (
    <section className="section">
      <div className="wrap">
        <p className="meta">{business.pilot.name}</p>
        <h1>Registration list</h1>
        <Suspense fallback={<p>Opening the list.</p>}>
          <AdminGate searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function AdminGate({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const params = await searchParams;
  const signedIn = await isAdmin();
  if (!signedIn) {
    return (
      <form className="form gap-top" method="post" action="/api/admin/login">
        <p>This page is for the teacher. Enter the password set on the server.</p>
        {!adminPasswordConfigured() ? (
          <p className="note">
            Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET before this door will open.
          </p>
        ) : null}
        {params.error ? (
          <p className="errors" role="alert">
            That password did not match.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="button" type="submit">
          Open the list
        </button>
      </form>
    );
  }

  if (!isDbConfigured()) {
    return (
      <p className="gap-top">
        The password worked. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or
        DATABASE_URL, to load registrations.
      </p>
    );
  }

  let rows: RegistrationRecord[] = [];
  let events: EmailEvent[] = [];
  try {
    [rows, events] = await Promise.all([listRegistrations(business.pilot.slug), listEvents()]);
  } catch {
    return <p className="gap-top">The list could not be loaded. Check the database connection.</p>;
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + row.students.length;
    return acc;
  }, {});
  const held =
    (counts.paid ?? 0) +
    (counts.processing ?? 0) +
    (counts.pending ?? 0) +
    (counts.pending_payment ?? 0);

  return (
    <div className="gap-top">
      <p className="summary-line">
        {counts.paid ?? 0} paid seats, {counts.pending ?? 0} unpaid card holds,{" "}
        {counts.pending_payment ?? 0} spots held for a payment link, {counts.waitlist ?? 0} on
        the waitlist. About {held} seats are spoken for out of {business.pilot.capacity}. A
        card hold drops off after {business.pilot.holdMinutes} minutes if the card is not
        paid. A spot held for a payment link stays on this list.
      </p>
      <p className="form-actions">
        <a className="button" href="/api/admin/export">
          Download CSV
        </a>
        <form method="post" action="/api/admin/logout">
          <button className="button-secondary" type="submit">
            Lock the list
          </button>
        </form>
      </p>
      <WaitlistNotify events={events} params={params} />
      <div className="roster">
        {rows.length === 0 ? <p>No sign-ups yet.</p> : null}
        {rows.map((row) => (
          <article key={row.id}>
            <p className={`status-${row.status}`}>
              <strong>{row.status === "pending_payment" ? "spot held" : row.status}</strong>
              {row.amountCents != null ? ` · ${formatDollars(row.amountCents)}` : ""}
              {row.paidAt ? ` · paid ${row.paidAt}` : ""}
            </p>
            <p>
              Photo consent: {row.photoRelease ? "yes" : "no"} · Updates:{" "}
              {row.updatesOptIn ? "yes" : "no"} · Heard: {row.heardAbout}
            </p>
            {row.students.map((student) => (
              <p key={`${row.id}-${student.name}-${student.age}`}>
                <strong>
                  {student.name}, age {student.age}
                </strong>
                . Allergies: {student.allergiesNotes || "none noted"}. Topping:{" "}
                {toppingLabel.get(student.topping as (typeof business.toppings)[number]["value"]) ??
                  student.topping}
                .
              </p>
            ))}
            <p>
              {row.parentName} · {row.parentEmail} · {row.parentPhone}
            </p>
            <p>
              Emergency: {row.emergencyName}, {row.emergencyRelationship}, {row.emergencyPhone}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function eventLabel(event: EmailEvent): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  return `${event.title} · ${formatBoiseDate(start)}, ${formatBoiseTimeRange(start, end)}`;
}

/**
 * "A new class opened" for the waitlist. Pick the class, see who would get
 * it, then send. Nothing is sent until the second button.
 */
async function WaitlistNotify({ events, params }: { events: EmailEvent[]; params: AdminParams }) {
  const emailOn = isEmailConfigured();
  const selected = params.notify && events.some((event) => event.id === params.notify)
    ? params.notify
    : "";

  let preview: WaitlistPreview | null = null;
  let previewError = false;
  if (selected) {
    try {
      preview = await previewWaitlistEmail(selected);
    } catch {
      previewError = true;
    }
  }

  const notifiedEvent = params.notified
    ? events.find((event) => event.id === params.notified)
    : undefined;

  return (
    <section className="gap-top" aria-labelledby="waitlist-notify">
      <h2 id="waitlist-notify">Tell the waitlist about a new class</h2>
      <p>
        Everyone on the waitlist for any class gets one email about the class you pick, unless
        they opted out. Pick the class, check the count, then send. Each family is emailed once
        per new class, so pressing send twice does not send twice.
      </p>
      {!emailOn ? (
        <p className="note">
          RESEND_API_KEY is not set, so nothing goes out. Sends are recorded as skipped. See
          docs/email.md.
        </p>
      ) : null}
      {params.notify_error === "event" ? (
        <p className="errors" role="alert">
          That class was not found. Pick it again.
        </p>
      ) : null}
      {params.notify_error === "send" ? (
        <p className="errors" role="alert">
          The send did not finish. Check the server log, then try again. Families already
          emailed will not get a second copy.
        </p>
      ) : null}
      {notifiedEvent ? (
        <p className="note" role="status">
          Done for {notifiedEvent.title}: {params.sent ?? "0"} sent, {params.already ?? "0"}{" "}
          already had it, {params.skipped ?? "0"} skipped, {params.failed ?? "0"} failed.
        </p>
      ) : null}
      <form className="form" method="get" action="/admin">
        <div className="field">
          <label htmlFor="notify">New class</label>
          <select id="notify" name="notify" defaultValue={selected} required>
            <option value="" disabled>
              Pick a class
            </option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {eventLabel(event)}
              </option>
            ))}
          </select>
        </div>
        <p className="form-actions">
          <button className="button-secondary" type="submit">
            Preview recipients
          </button>
        </p>
      </form>
      {previewError ? (
        <p className="errors" role="alert">
          The recipient list could not be loaded. Check the database connection.
        </p>
      ) : null}
      {preview ? (
        <div className="gap-top">
          <p className="summary-line">
            {preview.count} {preview.count === 1 ? "family" : "families"} will get the new-class
            email for {preview.event.title}.
            {preview.alreadyNotified ? ` ${preview.alreadyNotified} already had it.` : ""}
            {preview.optedOut ? ` ${preview.optedOut} opted out.` : ""}
            {preview.duplicates
              ? ` ${preview.duplicates} repeat ${preview.duplicates === 1 ? "address was" : "addresses were"} folded in.`
              : ""}
          </p>
          {preview.emails.length ? (
            <p style={{ wordBreak: "break-word" }}>{preview.emails.join(", ")}</p>
          ) : (
            <p>Nothing to send.</p>
          )}
          {preview.count > 0 ? (
            <form method="post" action="/api/admin/waitlist-notify">
              <input type="hidden" name="event_id" value={preview.event.id} />
              <input type="hidden" name="confirm" value="1" />
              <p className="form-actions">
                <button className="button" type="submit">
                  Send to {preview.count} {preview.count === 1 ? "family" : "families"}
                </button>
              </p>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
