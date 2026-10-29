import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres, { type Sql } from "postgres";
import { business } from "@/config/business";
import type { EmailKind } from "@/config/email";
import type { EmailEvent, EmailRegistration } from "@/emails/types";
import type { EmailLogKey, EmailLogRow } from "@/lib/email/mailer";
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

/* ---------- Email: events, recipients, log, opt-outs ---------- */

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string;
};

const eventColumns = "id, slug, title, starts_at, ends_at, location_name, location_address";

function mapEvent(row: EventRow): EmailEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    locationName: row.location_name,
    locationAddress: row.location_address,
  };
}

type EmailRegistrationRow = {
  id: string;
  event_id: string;
  status: string;
  parent_name: string;
  parent_email: string;
  amount_cents: number | null;
  students: { name: string }[] | null;
};

const emailRegistrationColumns =
  "id, event_id, status, parent_name, parent_email, amount_cents, students ( name )";

function mapEmailRegistration(row: EmailRegistrationRow): EmailRegistration {
  return {
    id: row.id,
    eventId: row.event_id,
    status: row.status,
    parentName: row.parent_name,
    parentEmail: row.parent_email,
    amountCents: row.amount_cents,
    studentNames: (row.students ?? []).map((student) => student.name),
  };
}

const emailRegistrationSelect = (s: Sql) => s`
  select r.id, r.event_id, r.status, r.parent_name, r.parent_email, r.amount_cents,
    coalesce(
      json_agg(json_build_object('name', s.name) order by s.created_at)
        filter (where s.id is not null),
      '[]'::json
    ) as students
  from registrations r
  left join students s on s.registration_id = r.id
`;

/** All classes, soonest first. */
export async function listEvents(): Promise<EmailEvent[]> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("events")
      .select(eventColumns)
      .order("starts_at", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => mapEvent(row as EventRow));
  }
  const rows = await sql()`
    select id, slug, title, starts_at, ends_at, location_name, location_address
    from events
    order by starts_at
  `;
  return rows.map((row) => mapEvent(row as EventRow));
}

export async function getEventById(eventId: string): Promise<EmailEvent | null> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("events")
      .select(eventColumns)
      .eq("id", eventId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapEvent(data as EventRow) : null;
  }
  const rows = await sql()`
    select id, slug, title, starts_at, ends_at, location_name, location_address
    from events
    where id = ${eventId}::uuid
  `;
  return rows[0] ? mapEvent(rows[0] as EventRow) : null;
}

/** One registration plus its class, shaped for a template. */
export async function getRegistrationForEmail(
  registrationId: string,
): Promise<{ registration: EmailRegistration; event: EmailEvent } | null> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("registrations")
      .select(emailRegistrationColumns)
      .eq("id", registrationId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    const registration = mapEmailRegistration(data as unknown as EmailRegistrationRow);
    const event = await getEventById(registration.eventId);
    return event ? { registration, event } : null;
  }
  const s = sql();
  const rows = await s`
    ${emailRegistrationSelect(s)}
    where r.id = ${registrationId}::uuid
    group by r.id
  `;
  if (!rows[0]) {
    return null;
  }
  const registration = mapEmailRegistration(rows[0] as EmailRegistrationRow);
  const event = await getEventById(registration.eventId);
  return event ? { registration, event } : null;
}

/** Registrations for a class in the given statuses, oldest first. */
export async function listRegistrationsForEmail(
  eventId: string,
  statuses: readonly string[],
): Promise<EmailRegistration[]> {
  if (statuses.length === 0) {
    return [];
  }
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("registrations")
      .select(emailRegistrationColumns)
      .eq("event_id", eventId)
      .in("status", [...statuses])
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => mapEmailRegistration(row as unknown as EmailRegistrationRow));
  }
  const s = sql();
  const rows = await s`
    ${emailRegistrationSelect(s)}
    where r.event_id = ${eventId}::uuid
      and r.status in ${s([...statuses])}
    group by r.id
    order by r.created_at
  `;
  return rows.map((row) => mapEmailRegistration(row as EmailRegistrationRow));
}

/** Every waitlist registration across all classes, oldest first. */
export async function listWaitlistRegistrations(): Promise<EmailRegistration[]> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("registrations")
      .select(emailRegistrationColumns)
      .eq("status", "waitlist")
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => mapEmailRegistration(row as unknown as EmailRegistrationRow));
  }
  const s = sql();
  const rows = await s`
    ${emailRegistrationSelect(s)}
    where r.status = 'waitlist'
    group by r.id
    order by r.created_at
  `;
  return rows.map((row) => mapEmailRegistration(row as EmailRegistrationRow));
}

type EmailLogDbRow = {
  id: string;
  registration_id: string;
  event_id: string;
  kind: EmailKind;
  status: EmailLogRow["status"];
  resend_id: string | null;
  error: string | null;
};

function mapEmailLog(row: EmailLogDbRow): EmailLogRow & { id: string } {
  return {
    id: row.id,
    registrationId: row.registration_id,
    eventId: row.event_id,
    kind: row.kind,
    status: row.status,
    resendId: row.resend_id,
    error: row.error,
  };
}

function logMatchesEvent(key: EmailLogKey): boolean {
  return key.kind === "waitlist_new_class";
}

async function findEmailLogRow(key: EmailLogKey): Promise<(EmailLogRow & { id: string }) | null> {
  if (backend() === "supabase") {
    let query = supabase()
      .from("email_log")
      .select("id, registration_id, event_id, kind, status, resend_id, error")
      .eq("registration_id", key.registrationId)
      .eq("kind", key.kind);
    if (logMatchesEvent(key)) {
      query = query.eq("event_id", key.eventId);
    }
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapEmailLog(data as EmailLogDbRow) : null;
  }
  const s = sql();
  const rows = logMatchesEvent(key)
    ? await s`
        select id, registration_id, event_id, kind, status, resend_id, error
        from email_log
        where registration_id = ${key.registrationId}::uuid
          and kind = ${key.kind}
          and event_id = ${key.eventId}::uuid
        limit 1
      `
    : await s`
        select id, registration_id, event_id, kind, status, resend_id, error
        from email_log
        where registration_id = ${key.registrationId}::uuid
          and kind = ${key.kind}
        limit 1
      `;
  return rows[0] ? mapEmailLog(rows[0] as EmailLogDbRow) : null;
}

export async function findEmailLog(key: EmailLogKey): Promise<EmailLogRow | null> {
  const row = await findEmailLogRow(key);
  if (!row) {
    return null;
  }
  const { id: _id, ...rest } = row;
  void _id;
  return rest;
}

function isUniqueViolation(message: string): boolean {
  return /duplicate key|23505|unique constraint/i.test(message);
}

/**
 * Insert or replace the log row for a key. A concurrent insert that trips the
 * unique index is treated as already recorded.
 */
export async function recordEmailLog(row: EmailLogRow): Promise<void> {
  const existing = await findEmailLogRow(row);
  if (backend() === "supabase") {
    const client = supabase();
    if (existing) {
      const { error } = await client
        .from("email_log")
        .update({
          status: row.status,
          resend_id: row.resendId,
          error: row.error,
          event_id: row.eventId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) {
        throw new Error(error.message);
      }
      return;
    }
    const { error } = await client.from("email_log").insert({
      registration_id: row.registrationId,
      event_id: row.eventId,
      kind: row.kind,
      status: row.status,
      resend_id: row.resendId,
      error: row.error,
    });
    if (error && !isUniqueViolation(`${error.code ?? ""} ${error.message}`)) {
      throw new Error(error.message);
    }
    return;
  }
  const s = sql();
  if (existing) {
    await s`
      update email_log
        set status = ${row.status},
            resend_id = ${row.resendId},
            error = ${row.error},
            event_id = ${row.eventId}::uuid,
            updated_at = now()
      where id = ${existing.id}::uuid
    `;
    return;
  }
  try {
    await s`
      insert into email_log (registration_id, event_id, kind, status, resend_id, error)
      values (
        ${row.registrationId}::uuid,
        ${row.eventId}::uuid,
        ${row.kind},
        ${row.status},
        ${row.resendId},
        ${row.error}
      )
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isUniqueViolation(message)) {
      throw error;
    }
  }
}

/** Registration ids already logged sent or skipped for a kind and class. */
export async function listNotifiedRegistrationIds(
  eventId: string,
  kind: EmailKind,
): Promise<string[]> {
  if (backend() === "supabase") {
    const { data, error } = await supabase()
      .from("email_log")
      .select("registration_id")
      .eq("event_id", eventId)
      .eq("kind", kind)
      .in("status", ["sent", "skipped"]);
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => (row as { registration_id: string }).registration_id);
  }
  const rows = await sql()`
    select registration_id
    from email_log
    where event_id = ${eventId}::uuid
      and kind = ${kind}
      and status in ('sent', 'skipped')
  `;
  return rows.map((row) => (row as { registration_id: string }).registration_id);
}

export async function listWaitlistOptOuts(): Promise<string[]> {
  if (backend() === "supabase") {
    const { data, error } = await supabase().from("waitlist_opt_outs").select("email");
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => (row as { email: string }).email);
  }
  const rows = await sql()`select email from waitlist_opt_outs`;
  return rows.map((row) => (row as { email: string }).email);
}

export async function addWaitlistOptOut(email: string): Promise<void> {
  const value = email.trim().toLowerCase();
  if (backend() === "supabase") {
    const { error } = await supabase()
      .from("waitlist_opt_outs")
      .upsert({ email: value }, { onConflict: "email", ignoreDuplicates: true });
    if (error) {
      throw new Error(error.message);
    }
    return;
  }
  await sql()`
    insert into waitlist_opt_outs (email) values (${value})
    on conflict (email) do nothing
  `;
}
