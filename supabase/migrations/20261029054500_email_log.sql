-- Transactional email log and waitlist opt-outs.
-- Every send is recorded once per (registration, kind). The "new class opened"
-- waitlist email is recorded once per (registration, kind, new event).
-- A family can opt out of waitlist emails by email address.
-- RLS is on and forced. No public role can read or write either table.
-- Only service_role (the server) touches them, the same as registrations.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  event_id uuid not null references public.events (id),
  kind text not null check (
    kind in (
      'confirmation_paid',
      'confirmation_pending',
      'waitlist',
      'reminder_5d',
      'reminder_1d',
      'waitlist_new_class'
    )
  ),
  status text not null check (status in ('sent', 'skipped', 'failed')),
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_log_registration_kind_idx
  on public.email_log (registration_id, kind)
  where kind <> 'waitlist_new_class';

create unique index if not exists email_log_waitlist_new_class_idx
  on public.email_log (registration_id, kind, event_id)
  where kind = 'waitlist_new_class';

create index if not exists email_log_event_kind_idx
  on public.email_log (event_id, kind, status);

create table if not exists public.waitlist_opt_outs (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.email_log enable row level security;
alter table public.waitlist_opt_outs enable row level security;

alter table public.email_log force row level security;
alter table public.waitlist_opt_outs force row level security;

revoke all on public.email_log from anon, authenticated;
revoke all on public.waitlist_opt_outs from anon, authenticated;

grant select, insert, update, delete on public.email_log to service_role;
grant select, insert, update, delete on public.waitlist_opt_outs to service_role;
