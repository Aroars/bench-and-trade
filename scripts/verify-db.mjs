import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrationDir = new URL("../supabase/migrations/", import.meta.url);

function family(kids, overrides = {}) {
  return {
    event_slug: "sawdust-and-slice",
    expected_price_cents: 4000,
    expected_capacity: 12,
    idempotency_key: randomUUID(),
    parent_name: "Ada Parent",
    parent_email: "Ada@Example.com",
    parent_phone: "(208) 555-0142",
    emergency_contact_name: "Sam Parent",
    emergency_contact_phone: "208-555-0199",
    emergency_contact_relationship: "Parent",
    heard_about: "A friend",
    updates_opt_in: true,
    photo_release: false,
    waiver_accepted: true,
    allergen_ack: true,
    students: Array.from({ length: kids }, (_, index) => ({
      name: `Kid ${index + 1}`,
      age: 8 + (index % 4),
      allergies_notes: index === 0 ? "peanuts" : "",
      topping: index % 2 === 0 ? "cheese" : "pepperoni",
    })),
    ...overrides,
  };
}

function asObject(value) {
  if (typeof value === "string") return JSON.parse(value);
  return value;
}

async function call(db, sql, params = []) {
  const result = await db.query(sql, params);
  return asObject(result.rows[0].result);
}

async function signup(db, payload) {
  return call(db, "select public.register_signup($1::jsonb) as result", [
    JSON.stringify(payload),
  ]);
}

async function spots(db) {
  return call(db, "select public.spots_for_event('sawdust-and-slice') as result");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectError(fn, snippet) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(snippet), `Expected "${snippet}" in: ${message}`);
    return;
  }
  throw new Error(`Expected an error containing "${snippet}"`);
}

const db = new PGlite();
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const name of migrationFiles) {
  await db.exec(readFileSync(new URL(name, migrationDir), "utf8"));
}

const seeded = await db.query(
  "select slug, price_cents, capacity, location_address from public.events",
);
assert(seeded.rows.length === 1, "pilot event was not seeded");
assert(seeded.rows[0].price_cents === 4000, "seed price drifted from config");
assert(seeded.rows[0].capacity === 12, "seed capacity drifted from config");
assert(
  seeded.rows[0].location_address === "2431 W Fairview Ave, Boise, ID 83702",
  "seed address drifted",
);

const firstKey = randomUUID();
const first = await signup(db, family(2, { idempotency_key: firstKey }));
assert(first.status === "pending", `first signup status ${first.status}`);
assert(first.kid_count === 2, "kid count");
assert(first.amount_cents === 8000, "amount");
assert(first.replayed === false, "first call should not replay");

const students = await db.query(
  "select name, allergies_notes, pizza_topping from public.students where registration_id = $1 order by name",
  [first.id],
);
assert(students.rows.length === 2, "students were not written");
assert(students.rows[0].allergies_notes === "peanuts", "allergy note missing");

const email = await db.query("select parent_email, photo_release from public.registrations where id = $1", [
  first.id,
]);
assert(email.rows[0].parent_email === "ada@example.com", "email was not normalized");
assert(email.rows[0].photo_release === false, "photo release");

const replay = await signup(db, family(2, { idempotency_key: firstKey }));
assert(replay.replayed === true, "idempotency replay");
assert(replay.id === first.id, "replay id");

await expectError(
  () => signup(db, family(1, { expected_price_cents: 1 })),
  "signup:config_mismatch",
);

const paid = await call(
  db,
  "select public.mark_registration_paid($1::uuid, $2, $3, $4) as result",
  [first.id, "pi_test_first", 8000, "cs_test_first"],
);
assert(paid.ok === true && paid.status === "paid", "mark paid");

const again = await call(
  db,
  "select public.mark_registration_paid($1::uuid, $2, $3, $4) as result",
  [first.id, "pi_test_first", 8000, "cs_test_first"],
);
assert(again.already === true, "paid webhook is idempotent");

const holdSix = await signup(db, family(6));
const holdFour = await signup(db, family(4));
assert(holdSix.status === "pending" && holdFour.status === "pending", "remaining seats");
let open = await spots(db);
assert(open.taken === 12, `expected a full class, taken ${open.taken}`);

const waiting = await signup(db, family(1));
assert(waiting.status === "waitlist", `expected waitlist, got ${waiting.status}`);
open = await spots(db);
assert(open.taken === 12, "waitlist must not take a seat");

const mismatch = await call(
  db,
  "select public.mark_registration_paid($1::uuid, $2, $3, $4) as result",
  [holdFour.id, "pi_wrong", 100, "cs_wrong"],
);
assert(mismatch.ok === false && mismatch.reason === "amount", "amount mismatch");

await db.query(
  "update public.registrations set created_at = now() - interval '31 minutes' where id = $1",
  [holdSix.id],
);
const afterExpire = await signup(db, family(1));
assert(afterExpire.status === "pending", "expired hold should free seats");
open = await spots(db);
assert(open.taken === 7, `taken after expired hold should be 7, was ${open.taken}`);

const eventId = (
  await db.query("select id from public.events where slug = 'sawdust-and-slice'")
).rows[0].id;

await db.exec("set role anon");
const publicEvents = await db.query("select slug from public.events");
assert(publicEvents.rows.length === 1, "anon can read the event");
await expectError(
  () => db.query("select count(*) from public.registrations"),
  "permission denied",
);
await expectError(
  () => db.query("select public.register_signup('{}'::jsonb)"),
  "permission denied",
);
await expectError(
  () =>
    db.query(
      `insert into public.registrations (
        event_id, idempotency_key, parent_name, parent_email, parent_phone,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        heard_about, photo_release, waiver_accepted, allergen_ack, status
      ) values ($1, $2, 'Pat', 'pat@example.com', '2085550100', 'Sam', '2085550101', 'Parent', 'Other', false, true, true, 'paid')`,
      [eventId, randomUUID()],
    ),
  "row-level security",
);
await expectError(
  () =>
    db.query(
      `insert into public.registrations (
        event_id, idempotency_key, parent_name, parent_email, parent_phone,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        heard_about, photo_release, waiver_accepted, allergen_ack, status
      ) values ($1, $2, 'Pat', 'pat@example.com', '2085550100', 'Sam', '2085550101', 'Parent', 'Other', false, true, true, 'pending_payment')`,
      [eventId, randomUUID()],
    ),
  "row-level security",
);
await expectError(
  () => db.query("select public.hold_registration_for_payment($1::uuid)", [randomUUID()]),
  "permission denied",
);
await db.query(
  `insert into public.registrations (
    event_id, idempotency_key, parent_name, parent_email, parent_phone,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
    heard_about, photo_release, waiver_accepted, allergen_ack
  ) values ($1, $2, 'Pat', 'pat@example.com', '2085550100', 'Sam', '2085550101', 'Parent', 'Other', false, true, true)`,
  [eventId, randomUUID()],
);
await db.exec("reset role");

const visible = await db.query(
  "select count(*)::int as count from public.registrations where parent_email = 'pat@example.com'",
);
assert(visible.rows[0].count === 1, "anon insert did not land");

const beta = await signup(db, family(2));
assert(beta.status === "pending", "beta signup starts pending");
const held = await call(
  db,
  "select public.hold_registration_for_payment($1::uuid) as result",
  [beta.id],
);
assert(
  held.ok === true && held.status === "pending_payment" && held.already === false,
  "hold for payment",
);
const heldAgain = await call(
  db,
  "select public.hold_registration_for_payment($1::uuid) as result",
  [beta.id],
);
assert(heldAgain.already === true, "hold is idempotent");

await db.query(
  "update public.registrations set created_at = now() - interval '2 days' where id = $1",
  [beta.id],
);
open = await spots(db);
assert(open.taken === 9, `pending_payment should keep seats, taken ${open.taken}`);

const overflow = await signup(db, family(4));
assert(overflow.status === "waitlist", "held spots count toward capacity");

await db.query("select public.release_registration($1::uuid)", [beta.id]);
const betaRow = await db.query("select status from public.registrations where id = $1", [beta.id]);
assert(betaRow.rows[0].status === "pending_payment", "release must not drop a held spot");

const paidBeta = await call(
  db,
  "select public.mark_registration_paid($1::uuid, $2, $3, $4) as result",
  [beta.id, "pi_beta", 8000, "cs_beta"],
);
assert(paidBeta.ok === true && paidBeta.status === "paid", "a held spot can be marked paid");

const badHold = await call(
  db,
  "select public.hold_registration_for_payment($1::uuid) as result",
  [waiting.id],
);
assert(badHold.ok === false && badHold.reason === "bad_status", "waitlist cannot be held");

// Email log: one row per (registration, kind), and per new class for the
// waitlist "new class" email. Opt-outs are keyed by address.
await db.query(
  "insert into public.email_log (registration_id, event_id, kind, status, resend_id) values ($1, $2, 'confirmation_paid', 'sent', 're_1')",
  [first.id, eventId],
);
await expectError(
  () =>
    db.query(
      "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'confirmation_paid', 'sent')",
      [first.id, eventId],
    ),
  "duplicate key",
);
await db.query(
  "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'reminder_5d', 'skipped')",
  [first.id, eventId],
);
await expectError(
  () =>
    db.query(
      "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'reminder_5d', 'sent')",
      [first.id, eventId],
    ),
  "duplicate key",
);
await expectError(
  () =>
    db.query(
      "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'postcard', 'sent')",
      [first.id, eventId],
    ),
  "check constraint",
);
await expectError(
  () =>
    db.query(
      "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'reminder_1d', 'queued')",
      [first.id, eventId],
    ),
  "check constraint",
);

const secondEvent = await db.query(
  `insert into public.events (slug, title, starts_at, ends_at, price_cents, capacity, min_age, max_age, location_name, location_address)
   values ('second-class', 'Second Class', '2027-03-15 10:00:00-06', '2027-03-15 12:00:00-06', 4000, 12, 7, 12, 'Casanova Pizzeria', '2431 W Fairview Ave, Boise, ID 83702')
   returning id`,
);
const secondEventId = secondEvent.rows[0].id;
await db.query(
  "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'waitlist_new_class', 'sent')",
  [waiting.id, secondEventId],
);
await expectError(
  () =>
    db.query(
      "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'waitlist_new_class', 'sent')",
      [waiting.id, secondEventId],
    ),
  "duplicate key",
);
await db.query(
  "insert into public.email_log (registration_id, event_id, kind, status) values ($1, $2, 'waitlist_new_class', 'sent')",
  [waiting.id, eventId],
);
const newClassRows = await db.query(
  "select count(*)::int as count from public.email_log where registration_id = $1 and kind = 'waitlist_new_class'",
  [waiting.id],
);
assert(newClassRows.rows[0].count === 2, "one new-class email per class is allowed");

await db.query("insert into public.waitlist_opt_outs (email) values ('ada@example.com')");
await db.query("insert into public.waitlist_opt_outs (email) values ('ada@example.com') on conflict (email) do nothing");
const optOuts = await db.query("select count(*)::int as count from public.waitlist_opt_outs");
assert(optOuts.rows[0].count === 1, "opt-out is keyed by address");

await db.exec("set role anon");
await expectError(() => db.query("select count(*) from public.email_log"), "permission denied");
await expectError(() => db.query("select count(*) from public.waitlist_opt_outs"), "permission denied");
await expectError(
  () => db.query("insert into public.waitlist_opt_outs (email) values ('x@example.com')"),
  "permission denied",
);
await db.exec("reset role");

console.log("verify-db: seat holds, payments, email log, and RLS checks passed");
await db.close();
