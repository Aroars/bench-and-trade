import { business } from "@/config/business";
import { stockPhotoList } from "@/config/photos";

const ownedHeroSources = [
  ["/photos/owned/hero-kids-robot-arena-800.jpg", 800],
  ["/photos/owned/hero-kids-robot-arena-1200.jpg", 1200],
  ["/photos/owned/hero-kids-robot-arena-1600.jpg", 1600],
  ["/photos/owned/hero-kids-robot-arena.jpg", 2048],
] as const;

/**
 * Home hero. Path, alt text, and focal point live in business.photos.hero
 * so a new photo is a config change. Owned hero photos have no caption.
 */
export function HeroPhoto() {
  const hero = business.photos.hero;
  const src: string = hero.src;
  const stock =
    business.photos.mode === "stock"
      ? stockPhotoList.find((photo) => photo.src === src)
      : undefined;
  const srcSet =
    src === "/photos/owned/hero-kids-robot-arena.jpg"
      ? ownedHeroSources.map(([path, width]) => `${path} ${width}w`).join(", ")
      : undefined;

  return (
    <figure className="shop-photo hero-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={hero.alt}
        srcSet={srcSet}
        sizes={srcSet ? "(min-width: 900px) 56vw, 100vw" : undefined}
        style={{ objectPosition: hero.focalPoint }}
      />
      {stock ? (
        <figcaption>
          Stock photo, not a Bench &amp; Trade class.{" "}
          <a href={stock.sourceUrl} target="_blank" rel="noopener noreferrer">
            {stock.photographer} on {stock.sourceName}
          </a>
        </figcaption>
      ) : null}
    </figure>
  );
}
