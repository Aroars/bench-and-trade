import { connection } from "next/server";
import { business } from "@/config/business";
import { startCheckout } from "@/lib/checkout";
import {
  holdRegistrationForPayment,
  isDbConfigured,
  registerSignup,
  releaseRegistration,
} from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { signupErrorMessage, signupSchema } from "@/lib/signup-schema";
import { isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  await connection();

  if (!isDbConfigured()) {
    return Response.json(
      {
        errors: [
          "Sign-up is not connected to a database yet. Set the Supabase environment variables, then try again.",
        ],
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: ["The form could not be read."] }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => issue.message);
    return Response.json({ errors: errors.length ? errors : ["Check the form."] }, { status: 400 });
  }

  let registration;
  try {
    registration = await registerSignup(parsed.data);
  } catch (error) {
    console.error("register_signup_failed");
    return Response.json({ errors: [signupErrorMessage(error)] }, { status: 400 });
  }

  if (registration.priceCents !== business.pilot.priceCents) {
    return Response.json(
      { errors: ["The class price in the database does not match the site."] },
      { status: 500 },
    );
  }

  if (registration.status === "waitlist") {
    return Response.json({
      status: "waitlist",
      registrationId: registration.id,
    });
  }

  if (registration.status === "paid") {
    return Response.json({
      status: "paid",
      registrationId: registration.id,
    });
  }

  if (registration.status === "pending_payment") {
    return Response.json({
      status: "pending_payment",
      registrationId: registration.id,
    });
  }

  if (registration.status !== "pending" && registration.status !== "processing") {
    return Response.json(
      { errors: ["This sign-up can no longer be paid. Send the form again."] },
      { status: 409 },
    );
  }

  if (!isStripeConfigured()) {
    if (registration.status !== "pending") {
      return Response.json(
        { errors: ["This sign-up can no longer be held. Send the form again."] },
        { status: 409 },
      );
    }
    const held = await holdRegistrationForPayment(registration.id);
    if (!held.ok) {
      return Response.json(
        {
          errors: ["We could not hold this spot. Send the form again. Nothing was charged."],
        },
        { status: 409 },
      );
    }
    return Response.json({
      status: "pending_payment",
      registrationId: registration.id,
    });
  }

  try {
    const checkoutUrl = await startCheckout({
      registration,
      studentNames: parsed.data.students.map((student) => student.name),
      parentEmail: parsed.data.parentEmail,
      origin: requestOrigin(request),
    });
    return Response.json({
      status: "pending",
      registrationId: registration.id,
      checkoutUrl,
    });
  } catch (error) {
    console.error("checkout_create_failed", error instanceof Error ? error.name : "error");
    await releaseRegistration(registration.id).catch(() => undefined);
    return Response.json(
      {
        errors: [
          "The payment page did not open. Nothing was charged, and the spot was released. Try again.",
        ],
      },
      { status: 502 },
    );
  }
}
