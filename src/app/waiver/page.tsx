import type { Metadata } from "next";
import { business } from "@/config/business";

export const metadata: Metadata = {
  title: "Liability waiver",
  description:
    "Placeholder waiver for Bench & Trade. This text must be replaced by a lawyer before anyone signs up.",
  robots: { index: false, follow: false },
};

export default function WaiverPage() {
  return (
    <>
      <div className="placeholder-banner">
        <div className="wrap">
          <p>
            PLACEHOLDER. This is not a waiver. Do not use it. A lawyer and the insurance
            company have to replace every section below before the first sign-up.
          </p>
        </div>
      </div>
      <article className="section">
        <div className="wrap measure stack">
          <h1>Liability waiver</h1>
          <p>
            {business.name} · {business.pilot.name} · {business.pilot.dateLabel}
          </p>

          <section>
            <p className="placeholder-tag">Placeholder</p>
            <h2>Who this is between</h2>
            <p>
              Replace this with the legal names of {business.name}, the instructor, and{" "}
              {business.sponsor.name} and its owners. The address of the class is{" "}
              {business.pilot.addressLine}, {business.pilot.locality}.
            </p>
          </section>

          <section>
            <p className="placeholder-tag">Placeholder</p>
            <h2>Assumption of risk</h2>
            <p>
              Replace this with counsel&apos;s language about hand tools, sawdust, and a
              restaurant patio. Do not publish this sentence as the assumption of risk.
            </p>
          </section>

          <section>
            <p className="placeholder-tag">Placeholder</p>
            <h2>Release and indemnity</h2>
            <p>
              Replace this with a release that names both {business.name} and{" "}
              {business.sponsor.name}, if counsel says that is the right structure. This
              paragraph is a marker, not a release.
            </p>
          </section>

          <section>
            <p className="placeholder-tag">Placeholder</p>
            <h2>Emergency medical care</h2>
            <p>
              Replace this with the permission to get emergency care, and with who pays.
              The sign-up form already collects an emergency contact and medical notes.
            </p>
          </section>

          <section>
            <p className="placeholder-tag">Placeholder</p>
            <h2>Photos</h2>
            <p>
              Photos are a separate yes or no on the sign-up form. They are not buried in
              this waiver. Replace this note if counsel wants different wording.
            </p>
          </section>

          <section className="note">
            <h2>Note for the owner, not for parents</h2>
            <p>
              Idaho courts have not clearly said a parent&apos;s signature stops a
              child&apos;s injury claim. Do not treat a waiver as the protection. Insurance
              that covers minors using tools, and the way class is run, matter more. This
              note is a reminder from the launch research. It is not legal advice.
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
