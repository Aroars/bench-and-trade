/**
 * Single source for Bench & Trade facts.
 * The pilot row in supabase/migrations must match slug, price, capacity,
 * ages, date, and address. The sign-up API refuses to charge if they differ.
 */

export const business = {
  name: "Bench & Trade",
  tagline: "Real tools. Real trades.",
  region: "Treasure Valley, Idaho",
  instructorName: "[INSTRUCTOR NAME]",
  contact: {
    email: "hello@benchandtrade.com",
    phoneDisplay: "(208) 555-0100",
    phoneHref: "tel:+12085550100",
  },
  ages: {
    min: 7,
    max: 12,
    laterNote: "Classes for teens come after this one is going.",
  },
  pilot: {
    slug: "sawdust-and-slice",
    name: "Sawdust & Slice",
    subtitle: "Saturday Shop Class and Personal Pizza",
    dateLabel: "Sat Nov 14, 2026",
    startsAt: "2026-11-14T10:00:00-07:00",
    endsAt: "2026-11-14T12:00:00-07:00",
    timeLabel: "10:00 AM to 12:00 PM",
    priceCents: 4000,
    capacity: 12,
    minAge: 7,
    maxAge: 12,
    holdMinutes: 30,
    maxKidsPerSignup: 6,
    venueName: "Casanova Pizzeria",
    addressLine: "2431 W Fairview Ave",
    locality: "Boise, ID 83702",
    schedule: [
      { time: "10:00", label: "Safety talk and tool demo" },
      { time: "10:15", label: "Build the mini pizza peel" },
      { time: "11:30", label: "Photos and show-and-tell" },
      { time: "11:40", label: "Pizza lunch" },
    ],
  },
  sponsor: {
    name: "Casanova Pizzeria",
    url: "https://www.casanovapizzeria.com/",
    /**
     * Horizontal wordmark from the official site image
     * 2a5563_2caf245ed9714688bf8d508ee75759ea~mv2.png, resized for this page.
     * Set to null to fall back to the text wordmark.
     */
    logoSrc: "/sponsors/casanova-pizzeria.jpg",
  },
  toppings: [
    { value: "cheese", label: "Cheese" },
    { value: "pepperoni", label: "Pepperoni" },
    { value: "own_food", label: "Bringing our own food" },
  ] as const,
  heardAbout: [
    "Casanova Pizzeria",
    "A homeschool Facebook group",
    "A friend",
    "A co-op",
    "Nextdoor",
    "A flyer or library board",
    "Other",
  ] as const,
  refund:
    "Full refund until 48 hours before the class. After that, the payment is credit toward the next class.",
  allergenNote:
    "The kitchen handles wheat, dairy, pine nuts, anchovies, and clams. Cross-contact is possible. This is not an allergy-safe meal.",
  /**
   * "stock" uses the Pexels files listed in src/config/photos.ts.
   * Set this to "owned" when real class photos are ready, then fill ownedPhotos.
   * hero.src, hero.alt, and hero.focalPoint are the home hero. Swap those three
   * when a real class photo is ready. focalPoint is a CSS object-position value.
   */
  photos: {
    mode: "stock" as "stock" | "owned",
    hero: {
      src: "/photos/owned/hero-kids-robot-arena.jpg",
      alt: "Kids gathered around a robot arena table, driving small robots with controllers.",
      focalPoint: "center",
    },
  },
} as const;

export type ToppingValue = (typeof business.toppings)[number]["value"];
export type HeardAbout = (typeof business.heardAbout)[number];

export function formatDollars(cents: number): string {
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100);
}

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
