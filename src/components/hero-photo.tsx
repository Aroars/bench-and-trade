import { business } from "@/config/business";
import { stockPhotoList } from "@/config/photos";

/**
 * Home hero. Path, alt text, and focal point live in business.photos.hero
 * so a new photo is a config change.
 */
export function HeroPhoto() {
  const hero = business.photos.hero;
  const stock =
    business.photos.mode === "stock"
      ? stockPhotoList.find((photo) => photo.src === hero.src)
      : undefined;

  return (
    <figure className="shop-photo hero-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={hero.src} alt={hero.alt} style={{ objectPosition: hero.focalPoint }} />
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
