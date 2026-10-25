-- Beta sign-ups made before Stripe keys exist.
-- pending_payment holds a seat with no time limit and is not a 30-minute card hold.
-- paid, processing, and pending_payment all count toward capacity.
-- A pending row still counts only for 30 minutes.

do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.registrations'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.registrations drop constraint %I', cname);
  end loop;
end
$$;

alter table public.registrations
  add constraint registrations_status_check
  check (
    status in (
      'pending',
      'processing',
      'paid',
      'waitlist',
      'expired',
      'failed',
      'pending_payment'
    )
  );

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
        r.status in ('paid', 'processing', 'pending_payment')
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
          r.status in ('paid', 'processing', 'pending_payment')
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

  if rec.status not in ('pending', 'processing', 'pending_payment') then
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

create or replace function public.hold_registration_for_payment(registration_id uuid)
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

  if rec.status = 'pending_payment' then
    return jsonb_build_object('ok', true, 'status', 'pending_payment', 'already', true);
  end if;

  if rec.status <> 'pending' or rec.stripe_checkout_session_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'bad_status', 'status', rec.status);
  end if;

  update public.registrations
    set status = 'pending_payment'
  where id = rec.id;

  return jsonb_build_object('ok', true, 'status', 'pending_payment', 'already', false);
end;
$$;

revoke all on function public.hold_registration_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.hold_registration_for_payment(uuid) to service_role;
