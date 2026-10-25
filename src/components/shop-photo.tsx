import { resolvePhoto, type PhotoSlot } from "@/config/photos";
import { PhotoWell } from "@/components/photo-well";

export function ShopPhoto({
  slot,
  framed = true,
}: {
  slot: PhotoSlot;
  framed?: boolean;
}) {
  const photo = resolvePhoto(slot);
  if (!photo) {
    return <PhotoWell label="A photo from a real Bench & Trade class." />;
  }

  return (
    <figure className={framed ? "shop-photo" : "shop-photo shop-photo-plain"}>
      {/* Local file from public/photos. Credit sits in the caption. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.alt} />
      <figcaption>
        Stock photo, not a Bench &amp; Trade class.{" "}
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
          {photo.photographer} on {photo.sourceName}
        </a>
      </figcaption>
    </figure>
  );
}
