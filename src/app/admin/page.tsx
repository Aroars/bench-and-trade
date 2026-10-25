import type { Metadata } from "next";
import { Suspense } from "react";
import { business, formatDollars } from "@/config/business";
import { adminPasswordConfigured, isAdmin } from "@/lib/admin-auth";
import { isDbConfigured, listRegistrations, type RegistrationRecord } from "@/lib/db";

export const metadata: Metadata = {
  title: "Registration list",
  robots: { index: false, follow: false },
};

const toppingLabel = new Map(business.toppings.map((topping) => [topping.value, topping.label]));

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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

async function AdminGate({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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
  try {
    rows = await listRegistrations(business.pilot.slug);
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
