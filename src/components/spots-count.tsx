"use client";

import { useEffect, useState } from "react";
import { business } from "@/config/business";

type SpotsResponse = {
  configured: boolean;
  capacity: number;
  taken: number | null;
  remaining: number | null;
  full: boolean;
  error?: string;
};

export function SpotsCount() {
  const [spots, setSpots] = useState<SpotsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/spots", { cache: "no-store" });
        const body = (await response.json()) as SpotsResponse;
        if (!cancelled) {
          setSpots(body);
        }
      } catch {
        if (!cancelled) {
          setSpots({
            configured: false,
            capacity: business.pilot.capacity,
            taken: null,
            remaining: null,
            full: false,
            error: "The spot count could not be loaded.",
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!spots) {
    return (
      <p className="spots" aria-live="polite">
        Checking spots. {business.pilot.capacity} kids maximum.
      </p>
    );
  }

  if (!spots.configured || spots.remaining == null) {
    return (
      <p className="spots" aria-live="polite">
        {business.pilot.capacity} kids maximum. The live count shows once the database is
        connected.
      </p>
    );
  }

  if (spots.error) {
    return <p className="spots">{spots.error}</p>;
  }

  if (spots.full) {
    return (
      <p className="spots spots-full" aria-live="polite">
        Full. {spots.capacity} spots are taken. You can join the waitlist.
      </p>
    );
  }

  const noun = spots.remaining === 1 ? "spot" : "spots";
  return (
    <p className="spots" aria-live="polite">
      {spots.remaining} {noun} left of {spots.capacity}.
    </p>
  );
}
