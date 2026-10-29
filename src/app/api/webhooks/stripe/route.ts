import { after, connection } from "next/server";
import type Stripe from "stripe";
import {
  markRegistrationExpired,
  markRegistrationFailed,
  markRegistrationPaid,
  markRegistrationProcessing,
} from "@/lib/db";
import { sendRegistrationEmail } from "@/lib/email";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  await connection();

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook secret is not set." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error("webhook_signature_failed", error instanceof Error ? error.name : "error");
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed" &&
    event.type !== "checkout.session.expired"
  ) {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) {
    console.error("webhook_missing_registration", event.type);
    return Response.json({ error: "Missing registration id." }, { status: 500 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      if (session.payment_status === "unpaid") {
        await markRegistrationProcessing(registrationId);
        return Response.json({ received: true, status: "processing" });
      }
      const amount = session.amount_total;
      if (amount == null) {
        return Response.json({ error: "Missing amount." }, { status: 500 });
      }
      const paymentIntent =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      const result = await markRegistrationPaid({
        registrationId,
        paymentIntentId: paymentIntent,
        amountCents: amount,
        checkoutSessionId: session.id,
      });
      if (!result.ok) {
        console.error("webhook_fulfill_failed", result.reason);
        return Response.json({ error: result.reason ?? "fulfill_failed" }, { status: 500 });
      }
      // After the 200 goes back to Stripe. The email log keeps a retried
      // webhook from sending twice, and a mail failure never fails the webhook.
      after(() => sendRegistrationEmail("confirmation_paid", registrationId));
      return Response.json({ received: true, status: result.status });
    }

    if (event.type === "checkout.session.async_payment_failed") {
      await markRegistrationFailed(registrationId);
      return Response.json({ received: true, status: "failed" });
    }

    await markRegistrationExpired(registrationId);
    return Response.json({ received: true, status: "expired" });
  } catch (error) {
    console.error("webhook_handler_failed", error instanceof Error ? error.name : "error");
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }
}
