import type { Metadata } from "next";
import { Suspense } from "react";
import { business, formatDollars } from "@/config/business";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: `Sign up for ${business.pilot.name}`,
  description: `Register a child for ${business.pilot.name} on ${business.pilot.dateLabel}. ${formatDollars(business.pilot.priceCents)} per kid.`,
};

export default function SignupPage() {
  return (
    <section className="section">
      <div className="wrap">
        <p className="meta">{business.pilot.dateLabel}</p>
        <h1>Sign up</h1>
        <p className="deck measure">
          {business.pilot.name}. {formatDollars(business.pilot.priceCents)} per kid. After
          this form you pay by card on a Stripe page. If the class is full, the form puts
          you on the waitlist and does not charge the card.
        </p>
        <div className="gap-top">
          <Suspense fallback={<p>Loading the form.</p>}>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
