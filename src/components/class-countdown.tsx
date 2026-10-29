import { connection } from "next/server";
import { business } from "@/config/business";
import { classCountdown } from "@/lib/countdown";

export async function ClassCountdown({ variant }: { variant: "badge" | "banner" }) {
  await connection();
  const view = classCountdown(new Date(), business.pilot.startsAt);
  if (!view) {
    return null;
  }

  return (
    <p className={variant === "badge" ? "countdown-badge" : "countdown-banner"} aria-label={view.aria}>
      <span className="countdown-big">{view.big}</span>
      <span className="countdown-small">{view.small}</span>
    </p>
  );
}
