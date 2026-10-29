import { connection } from "next/server";
import { business } from "@/config/business";
import { isAdmin } from "@/lib/admin-auth";
import { isDbConfigured, listRegistrations } from "@/lib/db";

function cell(value: string | number | boolean | null): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function GET() {
  await connection();
  if (!(await isAdmin())) {
    return new Response("Sign in required.", { status: 401 });
  }
  if (!isDbConfigured()) {
    return new Response("Database is not configured.", { status: 503 });
  }

  const rows = await listRegistrations(business.pilot.slug);
  const header = [
    "registration_id",
    "created_at",
    "status",
    "paid_at",
    "parent_name",
    "parent_email",
    "parent_phone",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relationship",
    "heard_about",
    "updates_opt_in",
    "photo_release",
    "waiver_accepted",
    "allergen_ack",
    "amount_cents",
    "stripe_payment_intent_id",
    "student_name",
    "student_age",
    "allergies_notes",
    "pizza_topping",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    const students = row.students.length ? row.students : [null];
    for (const student of students) {
      lines.push(
        [
          row.id,
          row.createdAt,
          row.status,
          row.paidAt,
          row.parentName,
          row.parentEmail,
          row.parentPhone,
          row.emergencyName,
          row.emergencyPhone,
          row.emergencyRelationship,
          row.heardAbout,
          row.updatesOptIn,
          row.photoRelease,
          row.waiverAccepted,
          row.allergenAck,
          row.amountCents,
          row.stripePaymentIntentId,
          student?.name ?? "",
          student?.age ?? "",
          student?.allergiesNotes ?? "",
          student?.topping ?? "",
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sawdust-and-slice-registrations.csv"',
    },
  });
}
