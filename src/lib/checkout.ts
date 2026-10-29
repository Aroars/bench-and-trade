import "server-only";
import { business } from "@/config/business";
import { attachCheckoutSession, type SignupResult } from "@/lib/db";
import { CHECKOUT_INTEGRATION_ID, getStripe } from "@/lib/stripe";

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function startCheckout(input: {
  registration: SignupResult;
  studentNames: string[];
  parentEmail: string;
  origin: string;
}): Promise<string> {
  const stripe = getStripe();
  const existingId = input.registration.stripeCheckoutSessionId;
  if (existingId) {
    const existing = await stripe.checkout.sessions.retrieve(existingId);
    if (existing.status === "open" && existing.url) {
      return existing.url;
    }
    if (existing.status === "complete") {
      return `${input.origin}/thank-you?session_id=${existing.id}`;
    }
  }

  const names = input.studentNames.map(cleanName);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.parentEmail,
      client_reference_id: input.registration.id,
      integration_identifier: CHECKOUT_INTEGRATION_ID,
      expires_at: Math.floor(Date.now() / 1000) + business.pilot.holdMinutes * 60,
      success_url: `${input.origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/events/${business.pilot.slug}/signup?canceled=1`,
      metadata: {
        registration_id: input.registration.id,
        student_names: names.join("; ").slice(0, 500),
      },
      payment_intent_data: {
        description: `${business.pilot.name}. Students: ${names.join(", ")}`.slice(0, 1000),
        metadata: {
          registration_id: input.registration.id,
          student_names: names.join("; ").slice(0, 500),
        },
      },
      line_items: names.map((name) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.registration.priceCents,
          product_data: {
            name: `${business.pilot.name}, ${name}`,
            description: `${business.name} shop class on ${business.pilot.dateLabel}. Student: ${name}.`,
            metadata: { student_name: name },
          },
        },
      })),
    },
    { idempotencyKey: `checkout_${input.registration.id}` },
  );

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  await attachCheckoutSession(input.registration.id, session.id);
  return session.url;
}
