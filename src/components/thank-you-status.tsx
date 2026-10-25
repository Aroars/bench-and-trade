"use client";

import { useEffect, useState } from "react";
import { business } from "@/config/business";

type StatusBody = {
  status?: string;
  studentNames?: string[];
  error?: string;
};

export function ThankYouStatus({
  sessionId,
  initialStatus,
}: {
  sessionId?: string;
  initialStatus?: string;
}) {
  const [status, setStatus] = useState(initialStatus ?? (sessionId ? "pending" : ""));
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/registrations/status?session_id=${encodeURIComponent(sessionId!)}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const body = (await response.json()) as StatusBody;
          if (!cancelled && body.status) {
            setStatus(body.status);
            setNames(body.studentNames ?? []);
            if (body.status === "paid" || body.status === "failed" || body.status === "expired") {
              return;
            }
          }
        }
      } catch {
        // Keep the last status and try again.
      }
      if (!cancelled && attempts < 8) {
        window.setTimeout(() => {
          void poll();
        }, 2000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "waitlist") {
    return (
      <>
        <h1>You are on the waitlist.</h1>
        <p className="deck">
          {business.pilot.name} is full, so we did not charge a card. We will contact you
          if a spot opens for {business.pilot.dateLabel}.
        </p>
      </>
    );
  }

  if (status === "paid") {
    return (
      <>
        <h1>You are signed up.</h1>
        <p className="deck">
          Payment went through for {business.pilot.name} on {business.pilot.dateLabel},{" "}
          {business.pilot.timeLabel}.
          {names.length ? ` Names on the receipt: ${names.join(", ")}.` : ""}
        </p>
        <p>
          We will email what to wear a few days before. Closed-toe shoes, hair tied back,
          clothes that can get dusty. The class is on the fenced patio at{" "}
          {business.pilot.venueName}, {business.pilot.addressLine}.
        </p>
      </>
    );
  }

  if (status === "failed" || status === "expired") {
    return (
      <>
        <h1>Payment did not finish.</h1>
        <p className="deck">
          The spot was not held. You can go back and send the form again. Nothing was
          marked paid.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>We are confirming payment.</h1>
      <p className="deck">
        If you finished the card page, Stripe has the payment. This page updates when our
        records do. You can close it. We have the email from the form.
      </p>
    </>
  );
}
