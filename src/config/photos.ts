import { business } from "@/config/business";

export type ShopPhoto = {
  src: string;
  alt: string;
  photographer: string;
  sourceName: "Pexels" | "Unsplash";
  sourceUrl: string;
};

/**
 * Stand-in photos. They are not Bench & Trade students.
 * sanding: hands on a wood block. bench: a boy in safety goggles at a soldering bench.
 */
export const stockPhotos = {
  sanding: {
    src: "/photos/stock/hands-sanding-wood.jpg",
    alt: "Hands sanding a small block of wood.",
    photographer: "cottonbro studio",
    sourceName: "Pexels",
    sourceUrl: "https://www.pexels.com/photo/a-person-using-a-sandpaper-on-a-piece-of-wood-7482645/",
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
