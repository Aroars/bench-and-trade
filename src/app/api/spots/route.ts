import { connection } from "next/server";
import { business } from "@/config/business";
import { getSpots, isDbConfigured } from "@/lib/db";

export async function GET() {
  await connection();

  if (!isDbConfigured()) {
    return Response.json({
      configured: false,
      capacity: business.pilot.capacity,
      taken: null,
      remaining: null,
      full: false,
    });
  }

  try {
    const spots = await getSpots(business.pilot.slug);
    if (!spots) {
      return Response.json(
        { configured: true, error: "The class is not in the database yet." },
        { status: 404 },
      );
    }
    const remaining = Math.max(spots.capacity - spots.taken, 0);
    return Response.json({
      configured: true,
      capacity: spots.capacity,
      taken: spots.taken,
      remaining,
      full: remaining === 0,
    });
  } catch (error) {
    console.error("spots_failed", error instanceof Error ? error.name : "error");
    return Response.json(
      { configured: true, error: "The spot count could not be loaded." },
      { status: 500 },
    );
  }
}
