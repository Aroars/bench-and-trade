-- Bench & Trade sign-ups.
-- Pilot facts must match src/config/business.ts:
--   slug sawdust-and-slice
--   Sat Nov 14, 2026, 10:00 to 12:00 America/Boise (MST, UTC-7)
--   price 4000 cents, capacity 12, ages 7 to 12
--   Casanova Pizzeria, 2431 W Fairview Ave, Boise, ID 83702
-- A pending registration holds its seats for 30 minutes (business.pilot.holdMinutes).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_cents integer not null check (price_cents > 0),
  capacity integer not null check (capacity > 0),
  min_age integer not null,
  max_age integer not null,
  location_name text not null,
  location_address text not null,
  created_at timestamptz not null default now(),
  check (max_age >= min_age)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  idempotency_key uuid not null unique,
  parent_name text not null,
  parent_email text not null,
  parent_phone text not null,
  emergency_contact_name text not null,
  emergency_contact_phone text not null,
  emergency_contact_relationship text not null,
  heard_about text not null,
  updates_opt_in boolean not null default false,
  photo_release boolean not null,
  waiver_accepted boolean not null,
  waiver_accepted_at timestamptz,
  allergen_ack boolean not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'paid', 'waitlist', 'expired', 'failed')
  ),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_cents integer,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (waiver_accepted),
  check (allergen_ack)
);

create unique index if not exists registrations_checkout_session_idx
  on public.registrations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status, created_at);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  name text not null,
  age integer not null,
  allergies_notes text,
  pizza_topping text not null,
  created_at timestamptz not null default now()
);

create index if not exists students_registration_idx
  on public.students (registration_id);

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.students enable row level security;

alter table public.events force row level security;
alter table public.registrations force row level security;
alter table public.students force row level security;

drop policy if exists events_public_read on public.events;
create policy events_public_read
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists registrations_public_insert on public.registrations;
create policy registrations_public_insert
  on public.registrations
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and paid_at is null
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
    and amount_cents is null
  );

drop policy if exists students_public_insert on public.students;
create policy students_public_insert
  on public.students
  for insert
  to anon, authenticated
  with check (true);

revoke all on public.events from anon, authenticated;
revoke all on public.registrations from anon, authenticated;
revoke all on public.students from anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.events to anon, authenticated, service_role;
grant insert on public.registrations to anon, authenticated;
grant insert on public.students to anon, authenticated;
grant select, insert, update, delete on public.events to service_role;
grant select, insert, update, delete on public.registrations to service_role;
grant select, insert, update, delete on public.students to service_role;

create or replace function public.register_signup(payload jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  ev public.events%rowtype;
  existing public.registrations%rowtype;
  taken integer;
  kid_count integer;
  new_id uuid;
  new_status text;
  amount integer;
  kid jsonb;
  kid_age integer;
begin
  if payload->>'idempotency_key' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'signup:idempotency';
  end if;

  if jsonb_typeof(payload->'waiver_accepted') is distinct from 'boolean'
     or payload->'waiver_accepted' is distinct from 'true'::jsonb then
    raise exception 'signup:waiver_required';
  end if;

  if jsonb_typeof(payload->'allergen_ack') is distinct from 'boolean'
     or payload->'allergen_ack' is distinct from 'true'::jsonb then
    raise exception 'signup:allergen_required';
  end if;

  if jsonb_typeof(payload->'photo_release') is distinct from 'boolean' then
    raise exception 'signup:photo_required';
  end if;

  if length(trim(coalesce(payload->>'parent_name', ''))) < 2 then
    raise exception 'signup:parent_name';
  end if;

  if coalesce(payload->>'parent_email', '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'signup:parent_email';
  end if;

  if length(regexp_replace(coalesce(payload->>'parent_phone', ''), '\D', '', 'g')) < 10 then
    raise exception 'signup:parent_phone';
  end if;

  if length(trim(coalesce(payload->>'emergency_contact_name', ''))) < 2
     or length(regexp_replace(coalesce(payload->>'emergency_contact_phone', ''), '\D', '', 'g')) < 10
     or length(trim(coalesce(payload->>'emergency_contact_relationship', ''))) < 2 then
    raise exception 'signup:emergency';
  end if;

  if length(trim(coalesce(payload->>'heard_about', ''))) < 2
     or length(trim(payload->>'heard_about')) > 80 then
    raise exception 'signup:heard_about';
  end if;

  if jsonb_typeof(payload->'students') is distinct from 'array'
     or jsonb_array_length(payload->'students') < 1
     or jsonb_array_length(payload->'students') > 6 then
    raise exception 'signup:students';
  end if;

  select * into ev
  from public.events
  where slug = payload->>'event_slug'
  for update;

  if not found then
    raise exception 'signup:event_missing';
  end if;

  if ev.price_cents is distinct from (payload->>'expected_price_cents')::integer
     or ev.capacity is distinct from (payload->>'expected_capacity')::integer then
    raise exception 'signup:config_mismatch';
  end if;

  select * into existing
  from public.registrations
  where idempotency_key = (payload->>'idempotency_key')::uuid;

  if found then
    select count(*)::integer into kid_count
    from public.students
    where registration_id = existing.id;

    return jsonb_build_object(
      'id', existing.id,
      'status', existing.status,
      'price_cents', ev.price_cents,
      'kid_count', kid_count,
      'amount_cents', coalesce(existing.amount_cents, ev.price_cents * kid_count),
      'stripe_checkout_session_id', existing.stripe_checkout_session_id,
      'replayed', true
    );
  end if;

  kid_count := jsonb_array_length(payload->'students');

  for kid in select value from jsonb_array_elements(payload->'students')
  loop
    if length(trim(coalesce(kid->>'name', ''))) < 1 then
      raise exception 'signup:student_name';
    end if;
    if coalesce(kid->>'age', '') !~ '^[0-9]+$' then
      raise exception 'signup:student_age';
    end if;
    kid_age := (kid->>'age')::integer;
    if kid_age < ev.min_age or kid_age > ev.max_age then
      raise exception 'signup:student_age';
    end if;
    if coalesce(kid->>'topping', '') not in ('cheese', 'pepperoni', 'own_food') then
      raise exception 'signup:topping';
    end if;
    if length(coalesce(kid->>'allergies_notes', '')) > 2000 then
      raise exception 'signup:allergies';
    end if;
  end loop;

  select coalesce(sum(seat_count), 0)::integer into taken
  from (
    select (
      select count(*)
      from public.students st
      where st.registration_id = r.id
    ) as seat_count
    from public.registrations r
    where r.event_id = ev.id
      and (
        r.status in ('paid', 'processing')
        or (
          r.status = 'pending'
          and r.created_at > now() - interval '30 minutes'
        )
      )
  ) seats;

  if taken + kid_count <= ev.capacity then
    new_status := 'pending';
  else
    new_status := 'waitlist';
  end if;

  amount := ev.price_cents * kid_count;

  insert into public.registrations (
    event_id,
    idempotency_key,
    parent_name,
    parent_email,
    parent_phone,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    heard_about,
    updates_opt_in,
    photo_release,
    waiver_accepted,
    waiver_accepted_at,
    allergen_ack,
    status,
    amount_cents
  ) values (
    ev.id,
    (payload->>'idempotency_key')::uuid,
    trim(payload->>'parent_name'),
    lower(trim(payload->>'parent_email')),
    trim(payload->>'parent_phone'),
    trim(payload->>'emergency_contact_name'),
    trim(payload->>'emergency_contact_phone'),
    trim(payload->>'emergency_contact_relationship'),
    trim(payload->>'heard_about'),
    coalesce((payload->>'updates_opt_in')::boolean, false),
    (payload->>'photo_release')::boolean,
    true,
    now(),
    true,
    new_status,
    amount
  )
  returning id into new_id;

  for kid in select value from jsonb_array_elements(payload->'students')
  loop
    insert into public.students (
      registration_id,
      name,
      age,
      allergies_notes,
      pizza_topping
    ) values (
      new_id,
      trim(kid->>'name'),
      (kid->>'age')::integer,
      nullif(trim(coalesce(kid->>'allergies_notes', '')), ''),
      kid->>'topping'
    );
  end loop;

  return jsonb_build_object(
    'id', new_id,
    'status', new_status,
    'price_cents', ev.price_cents,
    'kid_count', kid_count,
    'amount_cents', amount,
    'stripe_checkout_session_id', null,
    'replayed', false
  );
end;
$$;

create or replace function public.spots_for_event(event_slug text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'capacity', e.capacity,
    'taken', (
      select count(*)::integer
      from public.students s
      join public.registrations r on r.id = s.registration_id
      where r.event_id = e.id
        and (
          r.status in ('paid', 'processing')
          or (
            r.status = 'pending'
            and r.created_at > now() - interval '30 minutes'
          )
        )
    ),
    'price_cents', e.price_cents
  )
  from public.events e
  where e.slug = event_slug;
$$;

create or replace function public.attach_checkout_session(
  registration_id uuid,
  checkout_session text
)
returns text
language plpgsql
set search_path = public
as $$
declare
  existing text;
begin
  select stripe_checkout_session_id into existing
  from public.registrations
  where id = registration_id
  for update;

  if not found then
    raise exception 'signup:missing';
  end if;

  if existing is not null then
    return existing;
  end if;

  update public.registrations
    set stripe_checkout_session_id = checkout_session
  where id = registration_id;

  return checkout_session;
end;
$$;

create or replace function public.release_registration(registration_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.registrations
    set status = 'expired'
  where id = registration_id
    and status = 'pending'
    and stripe_checkout_session_id is null;
end;
$$;

create or replace function public.mark_registration_paid(
  registration_id uuid,
  payment_intent text,
  amount integer,
  checkout_session text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  rec public.registrations%rowtype;
begin
  select * into rec
  from public.registrations
  where id = registration_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  if rec.status = 'paid' then
    return jsonb_build_object('ok', true, 'status', 'paid', 'already', true);
  end if;

  if rec.status not in ('pending', 'processing') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', rec.status);
  end if;

  if rec.amount_cents is distinct from amount then
    return jsonb_build_object(
      'ok', false,
      'reason', 'amount',
      'expected', rec.amount_cents,
      'amount', amount
    );
  end if;

  update public.registrations
    set status = 'paid',
        paid_at = coalesce(paid_at, now()),
        stripe_payment_intent_id = payment_intent,
        stripe_checkout_session_id = coalesce(stripe_checkout_session_id, checkout_session)
  where id = rec.id;

  return jsonb_build_object('ok', true, 'status', 'paid', 'already', false);
end;
$$;

create or replace function public.mark_registration_processing(registration_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  rec public.registrations%rowtype;
begin
  select * into rec from public.registrations where id = registration_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if rec.status = 'pending' then
    update public.registrations set status = 'processing' where id = rec.id;
    return jsonb_build_object('ok', true, 'status', 'processing');
  end if;
  return jsonb_build_object('ok', true, 'status', rec.status);
end;
$$;

create or replace function public.mark_registration_expired(registration_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  rec public.registrations%rowtype;
begin
  select * into rec from public.registrations where id = registration_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if rec.status = 'pending' then
    update public.registrations set status = 'expired' where id = rec.id;
    return jsonb_build_object('ok', true, 'status', 'expired');
  end if;
  return jsonb_build_object('ok', true, 'status', rec.status);
end;
$$;

create or replace function public.mark_registration_failed(registration_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  rec public.registrations%rowtype;
begin
  select * into rec from public.registrations where id = registration_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if rec.status in ('pending', 'processing') then
    update public.registrations set status = 'failed' where id = rec.id;
    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;
  return jsonb_build_object('ok', true, 'status', rec.status);
end;
$$;

revoke all on function public.register_signup(jsonb) from public, anon, authenticated;
revoke all on function public.spots_for_event(text) from public, anon, authenticated;
revoke all on function public.attach_checkout_session(uuid, text) from public, anon, authenticated;
revoke all on function public.release_registration(uuid) from public, anon, authenticated;
revoke all on function public.mark_registration_paid(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.mark_registration_processing(uuid) from public, anon, authenticated;
revoke all on function public.mark_registration_expired(uuid) from public, anon, authenticated;
revoke all on function public.mark_registration_failed(uuid) from public, anon, authenticated;

grant execute on function public.register_signup(jsonb) to service_role;
grant execute on function public.spots_for_event(text) to service_role;
grant execute on function public.attach_checkout_session(uuid, text) to service_role;
grant execute on function public.release_registration(uuid) to service_role;
grant execute on function public.mark_registration_paid(uuid, text, integer, text) to service_role;
grant execute on function public.mark_registration_processing(uuid) to service_role;
grant execute on function public.mark_registration_expired(uuid) to service_role;
grant execute on function public.mark_registration_failed(uuid) to service_role;

insert into public.events (
  slug,
  title,
  starts_at,
  ends_at,
  price_cents,
  capacity,
  min_age,
  max_age,
  location_name,
  location_address
) values (
  'sawdust-and-slice',
  'Sawdust & Slice: Saturday Shop Class and Personal Pizza',
  '2026-11-14 10:00:00-07',
  '2026-11-14 12:00:00-07',
  4000,
  12,
  7,
  12,
  'Casanova Pizzeria',
  '2431 W Fairview Ave, Boise, ID 83702'
)
on conflict (slug) do update set
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  price_cents = excluded.price_cents,
  capacity = excluded.capacity,
  min_age = excluded.min_age,
  max_age = excluded.max_age,
  location_name = excluded.location_name,
  location_address = excluded.location_address;
