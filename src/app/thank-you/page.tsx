import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { business } from "@/config/business";
import { ThankYouStatus } from "@/components/thank-you-status";

export const metadata: Metadata = {
  title: "Sign-up received",
  robots: { index: false, follow: false },
};

export default function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; status?: string }>;
}) {
  return (
    <section className="section">
      <div className="wrap measure stack">
        <Suspense fallback={<h1>Checking your sign-up.</h1>}>
          <ThankYouGate searchParams={searchParams} />
        </Suspense>
        <p>
          <Link href={`/events/${business.pilot.slug}`}>Back to the class</Link>
        </p>
      </div>
    </section>
  );
}

async function ThankYouGate({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; status?: string }>;
}) {
  const params = await searchParams;
  return (
    <ThankYouStatus sessionId={params.session_id} initialStatus={params.status} />
  );
}
