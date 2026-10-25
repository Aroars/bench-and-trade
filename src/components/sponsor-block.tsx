import { business } from "@/config/business";

export function SponsorBlock() {
  const { sponsor, pilot } = business;
  return (
    <section className="sponsor" aria-label={`Sponsored by ${sponsor.name}`}>
      <p className="meta">Sponsored by</p>
      {sponsor.logoSrc ? (
        // Official wordmark, saved under public/sponsors.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logoSrc} alt={sponsor.name} />
      ) : (
        <p className="sponsor-wordmark">{sponsor.name}</p>
      )}
      <p>
        The instructor&apos;s family owns {sponsor.name}. They are hosting this class on
        the fenced patio at {pilot.addressLine}, Boise.
      </p>
      <p>
        <a href={sponsor.url} target="_blank" rel="noopener noreferrer">
          casanovapizzeria.com
        </a>
      </p>
    </section>
  );
}
