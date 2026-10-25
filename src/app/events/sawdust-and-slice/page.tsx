import type { Metadata } from "next";
import Link from "next/link";
import { business, formatDollars } from "@/config/business";
import { PhotoWell } from "@/components/photo-well";
import { SpotsCount } from "@/components/spots-count";
import { SponsorBlock } from "@/components/sponsor-block";

const pilot = business.pilot;

export const metadata: Metadata = {
  title: `${pilot.name}: ${pilot.subtitle}`,
  description: `Kids 7 to 12 build a mini pizza peel, then eat a personal pizza. ${pilot.dateLabel}, ${pilot.timeLabel}, at ${pilot.venueName} in Boise. ${formatDollars(pilot.priceCents)} per kid.`,
  openGraph: {
    title: `${pilot.name} · ${business.name}`,
    description: `${pilot.dateLabel}, ${pilot.timeLabel}. ${pilot.addressLine}, Boise. ${formatDollars(pilot.priceCents)} per kid.`,
  },
};

export default function EventPage() {
  return (
    <article>
      <section className="section">
        <div className="wrap split event-top">
          <PhotoWell label="A finished mini pizza peel next to a personal pizza on the patio table." />
          <div className="stack">
            <p className="meta">A {business.name} shop class</p>
            <h1>{pilot.name}</h1>
            <p className="deck">{pilot.subtitle}</p>
            <p className="price">{formatDollars(pilot.priceCents)} per kid</p>
            <SpotsCount />
            <p>
              Materials, safety glasses, and the pizza are included. Kids take the peel
              home.
            </p>
            <p>
              <Link className="button" href={`/events/${pilot.slug}/signup`}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap measure stack">
          <h2>What they build</h2>
          <p>
            A mini pizza peel: a small serving board, about 8 by 14 inches, cut from
            knot-free pine before class. In class they sand the edges, round the corners,
            drill the hang hole with a hand drill, put their name on the handle, and rub
            in food-safe mineral oil.
          </p>
          <p>They do not run a saw. The hard cuts are already done.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2>Program details</h2>
            <ul className="detail-list">
              <li>
                <span>Ages</span>
                <span>
                  {pilot.minAge} to {pilot.maxAge}
                </span>
              </li>
              <li>
                <span>Date</span>
                <span>{pilot.dateLabel}</span>
              </li>
              <li>
                <span>Time</span>
                <span>{pilot.timeLabel}</span>
              </li>
              <li>
                <span>Size</span>
                <span>{pilot.capacity} kids maximum</span>
              </li>
              <li>
                <span>Experience</span>
                <span>None needed</span>
              </li>
              <li>
                <span>Included</span>
                <span>Tools, glasses, materials, one-topping pizza</span>
              </li>
            </ul>
          </div>
          <div>
            <h2>The morning</h2>
            <ol className="schedule">
              {pilot.schedule.map((item) => (
                <li key={item.time}>
                  <span>{item.time}</span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap measure stack">
          <h3>Where</h3>
          <p>
            {pilot.venueName}
            <br />
            {pilot.addressLine}
            <br />
            {pilot.locality}
          </p>
          <p>
            The class is on the fenced patio, not in the dining room. Park at the
            restaurant. Kids stay inside the fence.
          </p>
          <h3>Parents</h3>
          <p>
            Parents stay for this one. You are welcome to watch. Kids are signed out to
            the same adult who signed them in.
          </p>
          <h3>What to wear</h3>
          <p>
            Closed-toe shoes. No sandals. Clothes that can get dusty. Hair tied back. No
            loose jewelry.
          </p>
          <h3>Weather</h3>
          <p>
            This is a patio class in November. Boise mornings can be cold. If we have to
            move the class or set a rain date, we will email you.
          </p>
          <h3>The kitchen</h3>
          <p className="note">{business.allergenNote} Tell us about allergies when you sign up. A child can bring their own food and still build.</p>
          <h3>Refunds</h3>
          <p>{business.refund}</p>
          <h3>IHLA funds</h3>
          <p>
            Using IHLA or TheoPay? Not for this date. When it is accepted, we will say so
            here.
          </p>
          <SponsorBlock />
          <p>
            <Link className="button" href={`/events/${pilot.slug}/signup`}>
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </article>
  );
}
