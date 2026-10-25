import { business } from "@/config/business";

export type ShopPhoto = {
  src: string;
  alt: string;
  photographer: string;
  sourceName: "Pexels" | "Unsplash";
  sourceUrl: string;
};

/**
 * Stand-in photos. Each one is a child doing shop or bench work with protection
 * the publisher describes (an apron or safety goggles). They are not Bench & Trade students.
 */
export const stockPhotos = {
  woodshop: {
    src: "/photos/stock/boy-apron-tools.jpg",
    alt: "A boy in a workshop apron holding hand tools.",
    photographer: "Safari Consoler",
    sourceName: "Pexels",
    sourceUrl: "https://www.pexels.com/photo/portrait-of-a-boy-wearing-an-apron-16850249/",
  },
  bench: {
    src: "/photos/stock/boy-goggles-soldering.jpg",
    alt: "A boy in safety goggles using a soldering iron at a bench.",
    photographer: "MART PRODUCTION",
    sourceName: "Pexels",
    sourceUrl: "https://www.pexels.com/photo/a-boy-wearing-goggles-using-a-soldering-iron-8471857/",
  },
} as const satisfies Record<string, ShopPhoto>;

export type PhotoSlot = keyof typeof stockPhotos;

/** Fill these when business.photos.mode is "owned". Missing slots fall back to a labeled drawing. */
export const ownedPhotos: Partial<Record<PhotoSlot, ShopPhoto>> = {};

export function resolvePhoto(slot: PhotoSlot): ShopPhoto | null {
  if (business.photos.mode === "owned") {
    return ownedPhotos[slot] ?? null;
  }
  return stockPhotos[slot];
}

export const stockPhotoList = Object.values(stockPhotos);
