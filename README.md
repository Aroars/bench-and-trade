# Bench & Trade

Sign-up site for a kids' shop class in the Treasure Valley. The first class is Sawdust & Slice: kids build a mini pizza peel, then eat a personal pizza on the fenced patio at Casanova Pizzeria.

Dates, price, capacity, the address, the instructor name, and the sponsor link live in `src/config/business.ts`. The pilot row in `supabase/migrations` has to match that file. The sign-up API will not open Checkout if the price or capacity disagree.

## Run it locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

`npm run test:db` applies the migrations to an in-memory Postgres (PGlite) and checks seat holds, the waitlist, payment marking, the email log, and row-level security. It does not need Docker or a Supabase project.

`npm test` runs the Vitest suite: reminder day math in Boise time, recipient selection, idempotency, and a render of every email template. `npm run lint`, `npm run typecheck`, and `npm run build` are the other checks.

## Environment variables

See `.env.example`.

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Checkout return URLs and Open Graph. On Vercel, `VERCEL_URL` is the fallback. |
| `SUPABASE_URL` | Server only. Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses RLS. Never put this in a `NEXT_PUBLIC_` variable. |
| `SUPABASE_ANON_KEY` | Not read by the app. Useful if you want to prove the public Data API cannot select registrations. |
| `DATABASE_URL` | Optional. If the Supabase URL is unset, the server talks to this Postgres instead. |
| `STRIPE_SECRET_KEY` | Test key only. `rk_test_` is preferred. `sk_test_` is accepted. Any live key is refused. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/stripe`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional. The page does not load Stripe.js. |
| `ADMIN_PASSWORD` | Password for `/admin`. |
| `ADMIN_SESSION_SECRET` | Signs the admin cookie. Use a long random string. Also signs waitlist unsubscribe links unless `EMAIL_UNSUBSCRIBE_SECRET` is set. |
| `RESEND_API_KEY` | Resend key for transactional email. Unset means sends are logged as skipped. See `docs/email.md`. |
| `EMAIL_FROM` | Optional From header. Defaults to `Bench & Trade <classes@send.benchandtrade.com>`. |
| `EMAIL_REPLY_TO` | Optional Reply-To header. Omitted when empty. |
| `EMAIL_UNSUBSCRIBE_SECRET` | Optional. Signs waitlist opt-out links. |
| `CRON_SECRET` | Vercel sends it to `/api/cron/reminders`. Vercel sets it when the cron deploys. |

On Vercel, mark the service role, Stripe secret, webhook secret, admin password, session secret, Resend key, and cron secret as sensitive.

A restricted Stripe key needs Checkout Sessions write and read. Webhook signature checks use `STRIPE_WEBHOOK_SECRET`, not the restricted key.

## Database

The migrations are in `supabase/migrations`. The first creates `events`, `registrations`, and `students`, turns on row-level security, and seeds the pilot. The second adds `pending_payment`. The third adds `email_log` and `waitlist_opt_outs` for transactional email.

Apply them in order, in either place:

1. Supabase SQL editor: paste the file and run it. The `anon`, `authenticated`, and `service_role` roles already exist there, so the role block does nothing.
2. Supabase CLI: `supabase db push` against the linked project.

Public roles may insert a registration only while it is still `pending` and has no payment fields. They may insert student rows. They may read events. They may not select, update, or delete registrations or students. The sign-up functions are `security invoker` (the default), with `search_path` fixed to `public`, and `execute` is granted only to `service_role`. They are not security-definer functions in an exposed schema.

Seat rules live in `register_signup`:

- `paid`, `processing`, and `pending_payment` seats count. `pending_payment` does not expire.
- `pending` seats count for 30 minutes, the same window as `business.pilot.holdMinutes` and the Checkout session expiry.
- If the whole family does not fit, the registration is `waitlist` and Checkout is not opened.
- Sending the same idempotency key again returns the existing row.

## Email

Resend sends a confirmation when a sign-up is saved (one version for paid, one for a held spot), a waitlist note when the class is full, reminders 5 days and 1 day before class from a daily Vercel Cron, and a "new class opened" email to the waitlist from a button on `/admin`. Every send is logged in `email_log` so nothing goes twice. Copy lives in `src/config/email-copy.ts`. Setup, DNS records for `send.benchandtrade.com`, and how to test are in `docs/email.md`.

## Stripe

Checkout is a hosted Stripe page. Each kid is a line item named `Sawdust & Slice, {student name}` so the receipt carries the student. The API version is `2026-09-30.endive`. The session sets `integration_identifier` to `bench-trade-pilot-mkqwxrpl`. The code does not pass `payment_method_types` and does not set `automatic_tax`.

Fulfillment happens in the webhook, not on the thank-you page. Point the endpoint at `https://<your-domain>/api/webhooks/stripe` and send:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

`completed` and `async_payment_succeeded` mark the row paid only when `payment_status` is not `unpaid`. An unpaid completion moves the row to `processing` so the seat stays held. A paid amount that does not match the stored total returns 500 so Stripe retries. Signatures are verified. The thank-you page only reads status.

Local webhook forwarding, once the CLI is logged in:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Put the printed `whsec_` value in `STRIPE_WEBHOOK_SECRET`. Use card `4242 4242 4242 4242` in test mode.

If `STRIPE_SECRET_KEY` is missing, sign-up does not open Checkout and does not expire the row. The registration becomes `pending_payment`, the seat stays counted, and the parent lands on a thank-you page that says the spot is held. Bench & Trade emails a payment link before the class. When a test key is set, new sign-ups go to Checkout again. A later paid webhook can mark a `pending_payment` row paid.

## Admin

`/admin` asks for `ADMIN_PASSWORD`. The cookie is httpOnly, same-site lax, and secure in production. The CSV download is `GET /api/admin/export`, one row per student. The page also has the "tell the waitlist about a new class" button: pick the class, preview the recipient count, confirm, send.

## Deploy

Import the repo in Vercel as a Next.js app, set the env vars, apply the migration, then add the webhook endpoint in the Stripe test dashboard. Do not put a live Stripe key in until you mean to charge cards. This build refuses live keys on purpose.

## Before a real class

- Replace the waiver. The page is a placeholder and says so. A lawyer has to review it. Idaho may not let a parent waive a child's claim. The note on the waiver page is not legal advice.
- Replace `[INSTRUCTOR NAME]`, the November 14, 2026 date, the price, and the capacity if those change. Change them in `src/config/business.ts` and in the events row together.
- Replace the phone and email. `(208) 555-0100` and `hello@benchandtrade.com` are placeholders.
- Add real photos. The page shows labeled drawings until then.
- The sponsor link is exactly `https://www.casanovapizzeria.com/`. The logo file is their horizontal wordmark from that site, saved at `public/sponsors/casanova-pizzeria.jpg`. Swap it if they send a different file, and set `sponsor.logoSrc` in the config. Set `logoSrc` to `null` to show the text wordmark instead.
- IHLA and TheoPay are not offered for this date. Do not promise them.
- Turn on live Stripe keys only after the test webhook has marked a row paid. Remove the test-key guard in `src/lib/stripe.ts` as part of that change, and use a separate live webhook secret.
