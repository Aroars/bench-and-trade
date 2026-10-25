"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { business, formatDollars } from "@/config/business";

type Kid = {
  key: string;
  name: string;
  age: string;
  allergies: string;
  topping: string;
};

const ages: number[] = [];
for (let age = business.pilot.minAge; age <= business.pilot.maxAge; age += 1) {
  ages.push(age);
}

function emptyKid(key: string): Kid {
  return { key, name: "", age: "", allergies: "", topping: "" };
}

export function SignupForm() {
  const search = useSearchParams();
  const router = useRouter();
  const canceled = search.get("canceled") === "1";
  const idempotencyKey = useRef<string | null>(null);
  const keyCount = useRef(2);
  const [kids, setKids] = useState<Kid[]>([emptyKid("kid-1")]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [full, setFull] = useState(false);
  const [spotNote, setSpotNote] = useState("Checking whether the class is full.");

  const total = kids.length * business.pilot.priceCents;

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/spots", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { full?: boolean; remaining?: number | null }) => {
        if (cancelled) return;
        if (body.full) {
          setFull(true);
          setSpotNote(
            "The class is full. Sending this form joins the waitlist and does not charge a card.",
          );
          return;
        }
        if (typeof body.remaining === "number") {
          setSpotNote(
            body.remaining === 1
              ? "1 spot left. If the class fills before you pay, this form joins the waitlist instead."
              : `${body.remaining} spots left. If the class fills before you pay, this form joins the waitlist instead.`,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpotNote(
            "If the class is full when you send this, you will be waitlisted and not charged.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateKid(key: string, patch: Partial<Kid>) {
    setKids((current) => current.map((kid) => (kid.key === key ? { ...kid, ...patch } : kid)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const localErrors: string[] = [];

    const parentName = String(data.get("parentName") ?? "").trim();
    const parentEmail = String(data.get("parentEmail") ?? "").trim();
    const parentPhone = String(data.get("parentPhone") ?? "").trim();
    const emergencyName = String(data.get("emergencyName") ?? "").trim();
    const emergencyPhone = String(data.get("emergencyPhone") ?? "").trim();
    const emergencyRelationship = String(data.get("emergencyRelationship") ?? "").trim();
    const heardAbout = String(data.get("heardAbout") ?? "");
    const photo = String(data.get("photoRelease") ?? "");
    const waiverAccepted = data.get("waiverAccepted") === "on";
    const allergenAck = data.get("allergenAck") === "on";

    if (parentName.length < 2) localErrors.push("Enter the parent name.");
    if (!parentEmail.includes("@")) localErrors.push("Enter a valid email.");
    if (parentPhone.replace(/\D/g, "").length < 10) {
      localErrors.push("Enter a parent phone number with an area code.");
    }
    if (emergencyName.length < 2 || emergencyPhone.replace(/\D/g, "").length < 10) {
      localErrors.push("Enter an emergency contact name and phone.");
    }
    if (emergencyRelationship.length < 2) {
      localErrors.push("Enter how you know the emergency contact.");
    }
    if (!heardAbout) localErrors.push("Tell us how you heard about the class.");
    if (photo !== "yes" && photo !== "no") localErrors.push("Choose yes or no for photos.");
    if (!waiverAccepted) localErrors.push("The waiver is required.");
    if (!allergenAck) localErrors.push("The kitchen allergen note is required.");

    const students = kids.map((kid, index) => {
      const age = Number(kid.age);
      if (!kid.name.trim()) localErrors.push(`Enter a name for child ${index + 1}.`);
      if (!Number.isInteger(age) || age < business.pilot.minAge || age > business.pilot.maxAge) {
        localErrors.push(
          `Choose an age from ${business.pilot.minAge} to ${business.pilot.maxAge} for child ${index + 1}.`,
        );
      }
      if (!kid.topping) localErrors.push(`Choose a topping for child ${index + 1}.`);
      return {
        name: kid.name.trim(),
        age,
        allergiesNotes: kid.allergies.trim(),
        topping: kid.topping,
      };
    });

    if (localErrors.length) {
      setErrors(localErrors);
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = crypto.randomUUID();
    }

    setSending(true);
    setErrors([]);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          parentName,
          parentEmail,
          parentPhone,
          emergencyName,
          emergencyPhone,
          emergencyRelationship,
          heardAbout,
          updatesOptIn: data.get("updatesOptIn") === "on",
          photoRelease: photo === "yes",
          waiverAccepted: true,
          allergenAck: true,
          students,
        }),
      });
      const body = (await response.json()) as {
        errors?: string[];
        status?: string;
        checkoutUrl?: string;
      };
      if (!response.ok) {
        setErrors(body.errors ?? ["We could not save the sign-up."]);
        setSending(false);
        return;
      }
      if (body.status === "waitlist") {
        router.push("/thank-you?status=waitlist");
        return;
      }
      if (body.status === "paid") {
        router.push("/thank-you?status=paid");
        return;
      }
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      setErrors(["The payment page did not open. Try again."]);
      setSending(false);
    } catch {
      setErrors(["The form did not send. Check your connection and try again."]);
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {canceled ? (
        <p className="note">
          Payment was canceled. Nothing was charged. You can send the form again.
        </p>
      ) : null}
      {errors.length ? (
        <div className="errors" role="alert">
          <p>Fix these before sending:</p>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p>{spotNote}</p>
      <p className="gap-top">
        {kids.length} {kids.length === 1 ? "child" : "children"} at{" "}
        {formatDollars(business.pilot.priceCents)} is {formatDollars(total)}. The card
        receipt lists each child&apos;s name.
      </p>

      <div className="field gap-top">
        <label htmlFor="parentName">
          Parent name <span className="meta">required</span>
        </label>
        <input id="parentName" name="parentName" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="parentEmail">
          Email <span className="meta">required</span>
        </label>
        <input id="parentEmail" name="parentEmail" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="parentPhone">
          Phone <span className="meta">required</span>
        </label>
        <input id="parentPhone" name="parentPhone" type="tel" autoComplete="tel" required />
      </div>

      {kids.map((kid, index) => (
        <fieldset className="kid" key={kid.key}>
          <legend>Child {index + 1}</legend>
          <div className="field">
            <label htmlFor={`${kid.key}-name`}>Name</label>
            <input
              id={`${kid.key}-name`}
              value={kid.name}
              onChange={(event) => updateKid(kid.key, { name: event.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${kid.key}-age`}>Age</label>
            <select
              id={`${kid.key}-age`}
              value={kid.age}
              onChange={(event) => updateKid(kid.key, { age: event.target.value })}
              required
            >
              <option value="">Choose</option>
              {ages.map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`${kid.key}-allergies`}>Allergies and medical notes</label>
            <textarea
              id={`${kid.key}-allergies`}
              value={kid.allergies}
              onChange={(event) => updateKid(kid.key, { allergies: event.target.value })}
              placeholder="Write none if there are none."
            />
          </div>
          <div className="field">
            <label htmlFor={`${kid.key}-topping`}>Pizza topping</label>
            <select
              id={`${kid.key}-topping`}
              value={kid.topping}
              onChange={(event) => updateKid(kid.key, { topping: event.target.value })}
              required
            >
              <option value="">Choose</option>
              {business.toppings.map((topping) => (
                <option key={topping.value} value={topping.value}>
                  {topping.label}
                </option>
              ))}
            </select>
          </div>
          {kids.length > 1 ? (
            <p className="field">
              <button
                className="button-secondary"
                type="button"
                onClick={() =>
                  setKids((current) => current.filter((item) => item.key !== kid.key))
                }
              >
                Remove this child
              </button>
            </p>
          ) : null}
        </fieldset>
      ))}

      {kids.length < business.pilot.maxKidsPerSignup ? (
        <p className="field">
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              const key = `kid-${keyCount.current}`;
              keyCount.current += 1;
              setKids((current) => [...current, emptyKid(key)]);
            }}
          >
            Add another child
          </button>
        </p>
      ) : null}

      <fieldset className="kid">
        <legend>Emergency contact</legend>
        <div className="field">
          <label htmlFor="emergencyName">Name</label>
          <input id="emergencyName" name="emergencyName" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="emergencyPhone">Phone</label>
          <input id="emergencyPhone" name="emergencyPhone" type="tel" autoComplete="tel" required />
        </div>
        <div className="field">
          <label htmlFor="emergencyRelationship">Relationship</label>
          <input
            id="emergencyRelationship"
            name="emergencyRelationship"
            placeholder="Grandparent, aunt, neighbor"
            required
          />
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="heardAbout">How did you hear about us?</label>
        <select id="heardAbout" name="heardAbout" defaultValue="" required>
          <option value="">Choose</option>
          {business.heardAbout.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="kid">
        <legend>Photos</legend>
        <p>
          May we photograph your child and use the pictures to tell people about Bench
          &amp; Trade, for example on Facebook or this website? No is a fine answer.
        </p>
        <div className="gap-top">
          <label className="radio">
            <input type="radio" name="photoRelease" value="yes" required />
            <span>Yes, you may take and use photos.</span>
          </label>
          <label className="radio">
            <input type="radio" name="photoRelease" value="no" />
            <span>No photos of my child.</span>
          </label>
        </div>
      </fieldset>

      <label className="check">
        <input type="checkbox" name="waiverAccepted" required />
        <span>
          I have read the{" "}
          <a href="/waiver" target="_blank" rel="noopener noreferrer">
            liability waiver
          </a>{" "}
          and I agree to it for the children named on this form. Required.
        </span>
      </label>
      <label className="check">
        <input type="checkbox" name="allergenAck" required />
        <span>I understand the kitchen note: {business.allergenNote} Required.</span>
      </label>
      <label className="check">
        <input type="checkbox" name="updatesOptIn" />
        <span>Email me when the monthly shop class is ready to sign up.</span>
      </label>

      <div className="form-actions">
        <button className="button" type="submit" disabled={sending}>
          {sending ? "Sending" : full ? "Join the waitlist" : "Continue to payment"}
        </button>
      </div>
      <noscript>
        <p>Turn on JavaScript to send this form, or call {business.contact.phoneDisplay}.</p>
      </noscript>
    </form>
  );
}
