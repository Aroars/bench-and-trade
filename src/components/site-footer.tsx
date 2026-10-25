import { business, formatDollars } from "@/config/business";

export function SiteFooter() {
  const { pilot, contact } = business;
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <h2>{business.name}</h2>
          <p>
            Shop class for kids in the {business.region}. The first class meets on the patio
            at {pilot.venueName}.
          </p>
          <p className="gap-top">
            {pilot.addressLine}
            <br />
            {pilot.locality}
          </p>
        </div>
        <div>
          <h2>Contact</h2>
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <br />
            <a href={contact.phoneHref}>{contact.phoneDisplay}</a>
          </p>
          <p className="gap-top">
            <a href="/waiver">Liability waiver</a>
          </p>
        </div>
        <div>
          <h2>Pilot class</h2>
          <p>
            {pilot.dateLabel}
            <br />
            {pilot.timeLabel}
            <br />
            {formatDollars(pilot.priceCents)} per kid
            <br />
            {pilot.capacity} kids maximum
          </p>
        </div>
      </div>
    </footer>
  );
}
