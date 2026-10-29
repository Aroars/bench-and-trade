import { ShopMark } from "@/components/shop-mark";

export function PhotoWell({
  label,
  ratio = "3-2",
}: {
  label: string;
  ratio?: "3-2" | "plain";
}) {
  return (
    <figure className="photo-well">
      <div className={ratio === "3-2" ? "ratio-3-2" : undefined}>
        <ShopMark />
      </div>
      <figcaption>Photo needed: {label}</figcaption>
    </figure>
  );
}
