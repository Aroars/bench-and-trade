import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-700.css";
import "@fontsource/rowdies/latin-400.css";
import "@fontsource/rowdies/latin-700.css";
import { business, siteUrl } from "@/config/business";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const description =
  "Shop class for kids ages 7 to 12 in the Treasure Valley. Real hand tools, small classes, and a project they take home.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${business.name} · Shop class for kids`,
    template: `%s · ${business.name}`,
  },
  description,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: business.name,
    title: `${business.name} · Shop class for kids`,
    description,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
