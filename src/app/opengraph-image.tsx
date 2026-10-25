import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { business } from "@/config/business";

export const alt = `${business.name}. ${business.tagline}. Shop class for kids in the Treasure Valley.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [heading, body] = await Promise.all([
    readFile(
      join(process.cwd(), "node_modules/@fontsource/rowdies/files/rowdies-latin-700-normal.woff"),
    ),
    readFile(
      join(
        process.cwd(),
        "node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff",
      ),
    ),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#141210",
          color: "#fffdf6",
          padding: "72px",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, color: "#ffd100", fontFamily: "Source Sans 3" }}>
          {business.name.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 92,
            lineHeight: 1.05,
            marginTop: 16,
            fontFamily: "Rowdies",
          }}
        >
          {business.tagline}
        </div>
        <div style={{ fontSize: 32, marginTop: 24, fontFamily: "Source Sans 3" }}>
          Shop class for kids, ages 7 to 12, Treasure Valley
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Rowdies", data: heading, weight: 700, style: "normal" },
        { name: "Source Sans 3", data: body, weight: 400, style: "normal" },
      ],
    },
  );
}
