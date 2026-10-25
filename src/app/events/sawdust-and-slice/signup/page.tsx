import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { business, formatDollars } from "@/config/business";
import { ShopPhoto } from "@/components/shop-photo";
import { SignupForm } from "@/components/signup-form";
import { isStripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = {
  title: `Sign up for ${business.pilot.name}`,
  description: `Register a child for ${business.pilot.name} on ${business.pilot.dateLabel}. ${formatDollars(business.pilot.priceCents)} per kid.`,
};

export default function SignupPage() {
  return (
    <section className="section">
      <div className="wrap">
        <Suspense fallback={<p>Loading the form.</p>}>
          <SignupBody />
        </Suspense>
      </div>
    </section>
  );
}

async function SignupBody() {
  await connection();
  const holdSpot = !isStripeConfigured();

  return (
    <div className="split">
      <div className="stack">
        <p className="meta">{business.pilot.dateLabel}</p>
        <h1>Sign up</h1>
        <p className="deck">
          {business.pilot.name}. {formatDollars(business.pilot.priceCents)} per kid.{" "}
          {holdSpot
            ? "Send the form to hold a spot. Bench & Trade will email a payment link before the class. Nothing is charged today."
            : "After this form you pay by card on a Stripe page."}{" "}
          If the class is full, the form puts you on the waitlist and does not charge a
          card.
        </p>
        <ShopPhoto slot="bench" />
      </div>
      <SignupForm paymentMode={holdSpot ? "hold" : "checkout"} />
    </div>
  );
}
