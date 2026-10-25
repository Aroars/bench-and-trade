import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { business, formatDollars } from "@/config/business";

export const alt = `${business.pilot.name}. ${business.pilot.dateLabel} at Casanova Pizzeria in Boise.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function EventOpenGraphImage() {
  const heading = await readFile(
    join(process.cwd(), "node_modules/@fontsource/zilla-slab/files/zilla-slab-latin-700-normal.woff"),
  );
  const body = await readFile(
    join(
      process.cwd(),
      "node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff",
    ),
  );
  const pilot = business.pilot;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#f3eee6",
          color: "#1c1914",
          padding: "72px",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, color: "#6e3428", fontFamily: "Source Sans 3" }}>
          {business.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 84, lineHeight: 1.05, marginTop: 12, fontFamily: "Zilla Slab" }}>
          {pilot.name}
        </div>
        <div style={{ fontSize: 32, marginTop: 20, fontFamily: "Source Sans 3" }}>
          {`${pilot.dateLabel} · ${pilot.timeLabel}`}
        </div>
        <div style={{ fontSize: 32, marginTop: 8, fontFamily: "Source Sans 3" }}>
          {`${pilot.addressLine}, Boise · ${formatDollars(pilot.priceCents)} per kid`}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Zilla Slab", data: heading, weight: 700, style: "normal" },
        { name: "Source Sans 3", data: body, weight: 400, style: "normal" },
      ],
    },
  );
}
