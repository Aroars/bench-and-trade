import Link from "next/link";
import { business, formatDollars } from "@/config/business";
import { PhotoWell } from "@/components/photo-well";
import { ShopPhoto } from "@/components/shop-photo";

export default function HomePage() {
  const { pilot, contact } = business;
  const price = formatDollars(pilot.priceCents);

  return (
    <>
      <section className="hero">
        <ShopPhoto slot="woodshop" />
        <div className="hero-sign">
          <p className="sticker">
            Ages {business.ages.min} to {business.ages.max}
          </p>
          <p className="kicker">{business.name}</p>
          <h1>{business.tagline}</h1>
          <p className="deck">
            A shop class for kids in the {business.region}. Hand tools, a project they take
            home, and a teacher who builds for a living.
          </p>
          <p>
            <Link className="button" href={`/events/${pilot.slug}`}>
              Saturday class
            </Link>
          </p>
        </div>
      </section>
      <div className="hazard" aria-hidden="true" />

      <section className="section">
        <div className="wrap measure stack">
          <h2>What this is</h2>
          <p>
            Bench &amp; Trade is a youth woodworking and trade-skills class. Kids use real
            hand tools: a tape, a hand drill, a sanding block, clamps. Safety glasses go
            on before anyone works at the bench. Groups stay small.
          </p>
          <p>
            This first run is for ages {business.ages.min} to {business.ages.max}.{" "}
            {business.ages.laterNote}
          </p>
          <p>
            It is not a craft hour. Kids measure, sand, drill, and finish. They leave with
            something they made.
          </p>
        </div>
      </section>
      <div className="ruler" aria-hidden="true" />

      <section className="section">
        <div className="wrap">
          <h2>Where do you want to start?</h2>
          <ul className="paths">
            <li className="path-with-photo">
              <ShopPhoto slot="bench" />
              <Link href={`/events/${pilot.slug}`}>
                <span className="meta">Saturday shop class</span>
                <span className="path-title">{pilot.name}</span>
                <span>
                  {pilot.subtitle}. {pilot.dateLabel}, {pilot.timeLabel}. {price} per kid.{" "}
                  {pilot.capacity} kids maximum. At {pilot.venueName}.
                </span>
                <span className="path-action">See the class</span>
              </Link>
            </li>
            <li>
              <Link href="/#contact">
                <span className="meta">Teens</span>
                <span className="path-title">Not open yet</span>
                <span>
                  Older kids will get their own class after this one is running. Ask to
                  be told when it is.
                </span>
                <span className="path-action">Ask us</span>
              </Link>
            </li>
            <li>
              <Link href="/#contact">
                <span className="meta">A question</span>
                <span className="path-title">Call or email</span>
                <span>
                  {contact.phoneDisplay} · {contact.email}
                </span>
                <span className="path-action">Contact</span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="section band-dark">
        <div className="wrap">
          <h2>How a class runs</h2>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <p>You sign up and pay for each kid. The receipt shows the child&apos;s name.</p>
            </li>
            <li>
              <span className="step-num">2</span>
              <p>
                Show up in closed-toe shoes. Tie long hair back. Leave loose jewelry at
                home. Clothes can get dusty.
              </p>
            </li>
            <li>
              <span className="step-num">3</span>
              <p>
                We start with a safety talk and a tool demo. Then the kids build. Parents
                can stay and watch.
              </p>
            </li>
            <li>
              <span className="step-num">4</span>
              <p>They take the project home.</p>
            </li>
          </ol>
          <p className="measure gap-top">
            One adult works the tables for every five or six kids, besides the teacher.
            Hand tools only at this age. No power saws.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <PhotoWell
            label={`${business.instructorName} at the bench with a kid, both in safety glasses.`}
          />
          <div className="stack">
            <h2>Who teaches</h2>
            <p>
              {business.instructorName} teaches the class. He is an artist and a builder,
              and he is good with kids. He is strict about eye protection and patient when
              a kid needs another try.
            </p>
            <p>
              His name on this page is still a placeholder. The real name, and how long he
              has worked in the trades, will be here before the first class.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Questions</h2>
          <div className="faq">
            <article>
              <h3>Who is it for?</h3>
              <p>
                Kids {business.ages.min} to {business.ages.max} for now. No shop experience
                needed.
              </p>
            </article>
            <article>
              <h3>Do parents stay?</h3>
              <p>
                Yes for the first class. You can watch. Kids are signed out to the same
                adult who signed them in.
              </p>
            </article>
            <article>
              <h3>What if the weather is bad?</h3>
              <p>
                The pilot is on a patio in November. If we move the time or set a rain
                date, we email you.
              </p>
            </article>
            <article>
              <h3>Can I get a refund?</h3>
              <p>{business.refund}</p>
            </article>
            <article>
              <h3>What about IHLA or TheoPay?</h3>
              <p>
                Not for this date. When it is accepted, we will say so on this page. Do
                not plan on it yet.
              </p>
            </article>
            <article>
              <h3>Is food included?</h3>
              <p>
                At {pilot.name}, yes: a personal one-topping pizza after the build. Read
                the kitchen note on the class page before you sign up. The kitchen is a
                working pizzeria.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section band-yellow" id="contact">
        <div className="wrap measure stack">
          <h2>Contact</h2>
          <p>Call or email. We answer.</p>
          <p>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <br />
            <a href={contact.phoneHref}>{contact.phoneDisplay}</a>
          </p>
          <p>
            The phone and email above are placeholders until the business line is set.
          </p>
          <p>
            <Link className="button" href={`/events/${pilot.slug}`}>
              Saturday class
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
