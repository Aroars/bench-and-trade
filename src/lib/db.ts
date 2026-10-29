import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { business } from "@/config/business";
import type { SignupInput } from "@/lib/signup-schema";

export type SignupResult = {
  id: string;
  status: string;
  priceCents: number;
  kidCount: number;
  amountCents: number;
  stripeCheckoutSessionId: string | null;
  replayed: boolean;
};

export type StudentRecord = {
  name: string;
  age: number;
  allergiesNotes: string | null;
  topping: string;
};

export type RegistrationRecord = {
  id: string;
  createdAt: string;
  status: string;
  paidAt: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  heardAbout: string;
  updatesOptIn: boolean;
  photoRelease: boolean;
  waiverAccepted: boolean;
  allergenAck: boolean;
  amountCents: number | null;
  stripePaymentIntentId: string | null;
  students: StudentRecord[];
};

export type Spots = {
  capacity: number;
  taken: number;
  priceCents: number;
};

type Backend = "supabase" | "postgres";

const globalForPg = globalThis as unknown as { benchPg?: Sql };

function backend(): Backend | null {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "supabase";
  }
  if (process.env.DATABASE_URL) {
    return "postgres";
  }
  return null;
}

export function isDbConfigured(): boolean {
  return backend() !== null;
}

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sql(): Sql {
  if (!globalForPg.benchPg) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set.");
    }
    globalForPg.benchPg = postgres(url, { max: 5 });
  }
  return globalForPg.benchPg;
}

function payloadFor(input: SignupInput) {
  return {
    event_slug: business.pilot.slug,
    expected_price_cents: business.pilot.priceCents,
    expected_capacity: business.pilot.capacity,
    idempotency_key: input.idempotencyKey,
    parent_name: input.parentName,
    parent_email: input.parentEmail,
    parent_phone: input.parentPhone,
    emergency_contact_name: input.emergencyName,
    emergency_contact_phone: input.emergencyPhone,
    emergency_contact_relationship: input.emergencyRelationship,
    heard_about: input.heardAbout,
    updates_opt_in: input.updatesOptIn,
    photo_release: input.photoRelease,
    waiver_accepted: input.waiverAccepted,
    allergen_ack: input.allergenAck,
    students: input.students.map((student) => ({
      name: student.name,
      age: student.age,
      allergies_notes: student.allergiesNotes,
      topping: student.topping,
    })),
  };
}

function mapSignup(value: unknown): SignupResult {
  const row = value as {
    id: string;
    status: string;
    price_cents: number;
    kid_count: number;
    amount_cents: number;
    stripe_checkout_session_id: string | null;
    replayed?: boolean;
  };
  return {
    id: row.id,
    status: row.status,
    priceCents: row.price_cents,
    kidCount: row.kid_count,
    amountCents: row.amount_cents,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    replayed: Boolean(row.replayed),
  };
}

export async function registerSignup(input: SignupInput): Promise<SignupResult> {
  const payload = payloadFor(input);
  if (backend() === "supabase") {
    const { data, error } = await supabase().rpc("register_signup", { payload });
    if (error) {
      throw new Error(error.message);
    }
    return mapSignup(data);
  }
  const rows = await sql()`select public.register_signup(${sql().json(payload)}) as result`;
  return mapSignup(rows[0]?.result);
}

export async function getSpots(eventSlug: string): Promise<Spots | null> {
  if (backend() === "supabase") {
    const { data, error } = await supabase().rpc("spots_for_event", {
      event_slug: eventSlug,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    const row = data as { capacity: number; taken: number; price_cents: number };
    return {
      capacity: row.capacity,
      taken: row.taken,
      priceCents: row.price_cents,
    };
  }
  const rows = await sql()`select public.spots_for_event(${eventSlug}) as result`;
  const result = rows[0]?.result as
    | { capacity: number; taken: number; price_cents: number }
    | null;
  if (!result) {
    return null;
  }
  return {
    capacity: result.capacity,
    taken: result.taken,
    priceCents: result.price_cents,
  };
}

export async function attachCheckoutSession(
  registrationId: string,
  checkoutSessionId: string,
): Promise<string> {
  if (backend() === "supabase") {
    const { data, error } = await supabase().rpc("attach_checkout_session", {
      registration_id: registrationId,
      checkout_session: checkoutSessionId,
    });
    if (error) {
      throw new Error(error.message);
    }
    return String(data);
  }
  const rows = await sql()`
    select public.attach_checkout_session(${registrationId}::uuid, ${checkoutSessionId}) as result
  `;
  return String(rows[0]?.result);
}

export async function holdRegistrationForPayment(registrationId: string): Promise<PaidResult> {
  if (backend() === "supabase") {
    return rpcFlag("hold_registration_for_payment", {
      registration_id: registrationId,
    });
  }
  const rows = await sql()`
    select public.hold_registration_for_payment(${registrationId}::uuid) as result
  `;
  return mapFlag(rows[0]?.result);
}

export async function releaseRegistration(registrationId: string): Promise<void> {
  if (backend() === "supabase") {
    const { error } = await supabase().rpc("release_registration", {
      registration_id: registrationId,
    });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }
  await sql()`select public.release_registration(${registrationId}::uuid)`;
}

export type PaidResult = {
  ok: boolean;
  status?: string;
  reason?: string;
  expected?: number;
  amount?: number;
  already?: boolean;
};

function mapFlag(value: unknown): PaidResult {
  const row = (value ?? {}) as PaidResult & { already?: boolean };
  return row;
}

async function rpcFlag(fn: string, args: Record<string, unknown>): Promise<PaidResult> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) {
    throw new Error(error.message);
  }
  return mapFlag(data);
}

export async function markRegistrationPaid(input: {
  registrationId: string;
  paymentIntentId: string | null;
  amountCents: number;
  checkoutSessionId: string;
}): Promise<PaidResult> {
  if (backend() === "supabase") {
    return rpcFlag("mark_registration_paid", {
      registration_id: input.registrationId,
      payment_intent: input.paymentIntentId,
      amount: input.amountCents,
      checkout_session: input.checkoutSessionId,
    });
  }
  const rows = await sql()`
    select public.mark_registration_paid(
      ${input.registrationId}::uuid,
      ${input.paymentIntentId},
      ${input.amountCents},
      ${input.checkoutSessionId}
    ) as result
  `;
  return mapFlag(rows[0]?.result);
}

export async function markRegistrationProcessing(registrationId: string): Promise<PaidResult> {
  if (backend() === "supabase") {
    return rpcFlag("mark_registration_processing", { registration_id: registrationId });
  }
  const rows = await sql()`select public.mark_registration_processing(${registrationId}::uuid) as result`;
  return mapFlag(rows[0]?.result);
}

export async function markRegistrationExpired(registrationId: string): Promise<PaidResult> {
  if (backend() === "supabase") {
    return rpcFlag("mark_registration_expired", { registration_id: registrationId });
  }
  const rows = await sql()`select public.mark_registration_expired(${registrationId}::uuid) as result`;
  return mapFlag(rows[0]?.result);
}

export async function markRegistrationFailed(registrationId: string): Promise<PaidResult> {
  if (backend() === "supabase") {
    return rpcFlag("mark_registration_failed", { registration_id: registrationId });
  }
  const rows = await sql()`select public.mark_registration_failed(${registrationId}::uuid) as result`;
  return mapFlag(rows[0]?.result);
}

type StatusRow = {
  status: string;
  students: { name: string }[] | null;
};

export async function registrationStatusBySession(sessionId: string): Promise<{
  status: string;
  studentNames: string[];
} | null> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("registrations")
      .select("status, students(name)")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    const row = data as StatusRow;
    return {
      status: row.status,
      studentNames: (row.students ?? []).map((student) => student.name),
    };
  }
  const rows = await sql()`
    select r.status,
      coalesce(
        json_agg(s.name order by s.created_at) filter (where s.id is not null),
        '[]'::json
      ) as names
    from registrations r
    left join students s on s.registration_id = r.id
    where r.stripe_checkout_session_id = ${sessionId}
    group by r.id
  `;
  const row = rows[0] as { status: string; names: string[] } | undefined;
  if (!row) {
    return null;
  }
  return { status: row.status, studentNames: row.names };
}

function mapRegistration(row: {
  id: string;
  created_at: string;
  status: string;
  paid_at: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  heard_about: string;
  updates_opt_in: boolean;
  photo_release: boolean;
  waiver_accepted: boolean;
  allergen_ack: boolean;
  amount_cents: number | null;
  stripe_payment_intent_id: string | null;
  students: {
    name: string;
    age: number;
    allergies_notes: string | null;
    pizza_topping: string;
  }[] | null;
}): RegistrationRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    paidAt: row.paid_at,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    parentPhone: row.parent_phone,
    emergencyName: row.emergency_contact_name,
    emergencyPhone: row.emergency_contact_phone,
    emergencyRelationship: row.emergency_contact_relationship,
    heardAbout: row.heard_about,
    updatesOptIn: row.updates_opt_in,
    photoRelease: row.photo_release,
    waiverAccepted: row.waiver_accepted,
    allergenAck: row.allergen_ack,
    amountCents: row.amount_cents,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    students: (row.students ?? []).map((student) => ({
      name: student.name,
      age: student.age,
      allergiesNotes: student.allergies_notes,
      topping: student.pizza_topping,
    })),
  };
}

export async function listRegistrations(eventSlug: string): Promise<RegistrationRecord[]> {
  if (backend() === "supabase") {
    const { data: event, error: eventError } = await supabase()
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle();
    if (eventError) {
      throw new Error(eventError.message);
    }
    if (!event) {
      return [];
    }
    const { data, error } = await supabase()
      .from("registrations")
      .select(
        `id, created_at, status, paid_at, parent_name, parent_email, parent_phone,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
         heard_about, updates_opt_in, photo_release, waiver_accepted, allergen_ack,
         amount_cents, stripe_payment_intent_id,
         students ( name, age, allergies_notes, pizza_topping )`,
      )
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) =>
      mapRegistration(row as Parameters<typeof mapRegistration>[0]),
    );
  }

  const rows = await sql()`
    select r.id, r.created_at, r.status, r.paid_at, r.parent_name, r.parent_email,
      r.parent_phone, r.emergency_contact_name, r.emergency_contact_phone,
      r.emergency_contact_relationship, r.heard_about, r.updates_opt_in,
      r.photo_release, r.waiver_accepted, r.allergen_ack, r.amount_cents,
      r.stripe_payment_intent_id,
      coalesce(
        json_agg(
          json_build_object(
            'name', s.name,
            'age', s.age,
            'allergies_notes', s.allergies_notes,
            'pizza_topping', s.pizza_topping
          )
          order by s.created_at
        ) filter (where s.id is not null),
        '[]'::json
      ) as students
    from registrations r
    left join students s on s.registration_id = r.id
    where r.event_id = (select id from events where slug = ${eventSlug})
    group by r.id
    order by r.created_at
  `;
  return rows.map((row) => mapRegistration(row as Parameters<typeof mapRegistration>[0]));
}
