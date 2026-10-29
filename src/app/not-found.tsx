import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="wrap measure stack">
        <h1>That page is not here.</h1>
        <p>
          <Link href="/">Back to Bench &amp; Trade</Link>
        </p>
      </div>
    </section>
  );
}
