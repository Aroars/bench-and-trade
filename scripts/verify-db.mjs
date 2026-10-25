import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = new URL(
  "../supabase/migrations/20261025173814_init_signups.sql",
  import.meta.url,
);

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
const sql = readFileSync(migrationPath, "utf8");
await db.exec(sql);

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

console.log("verify-db: seat holds, payments, and RLS checks passed");
await db.close();
