# Email

Bench & Trade sends six kinds of email through [Resend](https://resend.com). Every send is logged once in `email_log`, so retries, webhook replays, and repeated cron runs never send twice.

| Kind | When | Who |
| --- | --- | --- |
| `confirmation_paid` | The Stripe webhook marks a row paid | The parent on that registration |
| `confirmation_pending` | A sign-up lands as `pending_payment` (Stripe off, spot held) | The parent |
| `waitlist` | A sign-up lands as `waitlist` | The parent |
| `reminder_5d` | Daily cron, when class is 5 Boise calendar days away | Registrations in a reminder status |
| `reminder_1d` | Daily cron, when class is 1 Boise calendar day away | Registrations in a reminder status |
| `waitlist_new_class` | The teacher presses send on `/admin` | Everyone on the waitlist for any class, once per family |

Emails go only to `parent_email` on the registration row. Nothing is sent on event insert.

## Environment variables

| Name | Required | What it does |
| --- | --- | --- |
| `RESEND_API_KEY` | For real sends | Resend API key. When unset, each send logs one line (`email skipped ...`) and is recorded as `skipped`. Sign-ups and webhooks still succeed. |
| `EMAIL_FROM` | No | From header. Default `Bench & Trade <classes@send.benchandtrade.com>`. The domain must be verified in Resend. |
| `EMAIL_REPLY_TO` | No | Reply-To header. Left off the message when empty. |
| `EMAIL_UNSUBSCRIBE_SECRET` | No | Signs waitlist opt-out links. Falls back to `ADMIN_SESSION_SECRET`. With neither set, waitlist emails go out without an opt-out link. |
| `CRON_SECRET` | For reminders | Vercel sends `Authorization: Bearer $CRON_SECRET` to the cron route. Vercel creates it on the project when a cron is deployed; copy it to `.env.local` to run the job by hand. |

On Vercel, mark `RESEND_API_KEY`, `EMAIL_UNSUBSCRIBE_SECRET`, and `CRON_SECRET` as sensitive.

## Apply the migration

`supabase/migrations/20261029054500_email_log.sql` adds `email_log` and `waitlist_opt_outs`. Both have row-level security on and forced, no policies for `anon` or `authenticated`, and grants only to `service_role`, the same as `registrations`. Apply it the same way as the earlier migrations: paste into the Supabase SQL editor, or `supabase db push`.

`npm run test:db` applies every migration to an in-memory Postgres and checks the unique indexes and that `anon` cannot read either table.

## Resend domain setup for send.benchandtrade.com

Sending from a subdomain keeps the root domain's reputation separate from bulk mail. The DNS for `benchandtrade.com` is on Vercel, so the records below are added in Vercel: Dashboard, Domains, `benchandtrade.com`, DNS Records. Add each record with the name shown relative to `benchandtrade.com`.

1. In Resend, go to Domains, Add Domain, enter `send.benchandtrade.com`, pick the region closest to Boise (US East), and leave click and open tracking off for transactional mail.
2. Resend shows three or four records. Add them in Vercel DNS exactly as shown. The values are generated per account, so copy them from the Resend page rather than from here.
   - **DKIM**: TXT record, name `resend._domainkey.send`, value starting `p=MIGf...`.
   - **SPF** for the bounce subdomain: TXT record, name `send` (Resend may show `send.benchandtrade.com`), value `v=spf1 include:amazonses.com ~all`.
   - **MX** for the bounce subdomain: MX record, name `send`, value `feedback-smtp.us-east-1.amazonses.com`, priority `10`. The region in the hostname matches the region you picked.
   - If Resend shows a **DMARC** record, add it. If not, add this suggested one anyway: TXT record, name `_dmarc`, value `v=DMARC1; p=none; rua=mailto:hello@benchandtrade.com`. Start with `p=none`, watch the reports for a couple of weeks, then move to `p=quarantine`.
3. Back in Resend, press Verify. Vercel DNS usually propagates in a few minutes. Resend keeps checking on its own.
4. Create an API key in Resend with sending access only, scoped to this domain, and put it in `RESEND_API_KEY` on Vercel.
5. If `benchandtrade.com` already has an SPF record for another sender, do not touch it. The SPF above is for the `send` subdomain only.

If `EMAIL_FROM` is ever changed to another address, that address's domain must also be verified in Resend, or every send fails with `validation_error` and lands in `email_log` as `failed`.

## Edit the words

All copy is in `src/config/email-copy.ts`: subjects, previews, headings, greetings, the body paragraphs, the excitement note in the reminders, the sign-off, the contact line, and the footer. Edit the strings and redeploy. Curly tokens such as `{kidNames}` and `{dateLabel}` are filled from the registration and the class; the comment at the top of the file lists them. A token that is misspelled stays visible in the email, and the template test fails, so a typo cannot ship quietly.

What to wear and what to bring come from `business.classNotes` in `src/config/business.ts`. Empty a list to drop that block from the reminder.

Layout and colors are in `src/emails/shell.tsx`. The templates are the other files in `src/emails/`. They use React Email components with inline styles and the Bench & Trade tokens from `DESIGN.md`.

## Change who gets reminders

`reminderRecipientStatuses` in `src/config/email.ts` is `["paid", "processing", "pending_payment"]`. Remove `"pending_payment"` for paid-only reminders. The cron never emails `pending`, `waitlist`, `expired`, `failed`, or `cancelled` rows.

The offsets are `reminderOffsets` in the same file: 5 days and 1 day before, counted in Boise calendar days. The cron runs at 16:00 UTC, which is 9:00 AM in Boise during standard time and 10:00 AM during daylight time. Change the schedule in `vercel.json`.

## The daily cron

`vercel.json` registers `GET /api/cron/reminders` at `0 16 * * *`. The route checks the bearer header against `CRON_SECRET`, lists every class, computes how many Boise days away each one is, and sends the matching reminder to every registration in a reminder status. The response is a JSON tally per class.

Run it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://benchandtrade.com/api/cron/reminders
```

Running it twice on the same day sends nothing the second time. Each `(registration, kind)` is recorded in `email_log` and checked before every send.

## Tell the waitlist about a new class

On `/admin`, under "Tell the waitlist about a new class", pick the class, press "Preview recipients", read the count and the addresses, then press "Send to N families". The confirm step posts to `/api/admin/waitlist-notify`, which requires the admin cookie.

Who is included: every registration with status `waitlist`, for any class other than the one picked, one email per address, minus anyone in `waitlist_opt_outs`. Each family is logged per `(registration, waitlist_new_class, new event)`, so a second press sends nothing, and a later class can notify the same families again.

The sign-up link in that email is `/events/<slug>` for the new class. The site only has a page for the pilot slug today, so add a page for the new class before sending.

## Opt-out

Waitlist emails carry a signed link to `/api/email/unsubscribe` and the one-click `List-Unsubscribe` headers. The page confirms with one button and records the address in `waitlist_opt_outs`. Confirmations and reminders are transactional: no opt-out link, but every email carries the contact line.

## Resend again, or skip someone

- To resend one email, delete its `email_log` row and trigger the send again (rerun the cron, replay the webhook from the Stripe dashboard, or press the admin button).
- A `failed` row is retried automatically on the next trigger. `sent` and `skipped` rows are final.
- To keep a family from getting a reminder, delete or change their registration status, or add a `skipped` row for that `(registration_id, kind)` by hand.

## Test with a Resend address

Resend accepts `delivered@resend.dev` as a recipient that always delivers (and `bounced@resend.dev`, `complained@resend.dev` for the other paths). Sign up on a preview deployment with `delivered@resend.dev` as the parent email, then look at the Emails tab in Resend. The message shows up there with the subject and both bodies even though no inbox receives it.

To eyeball the templates without sending, run:

```bash
npm run email:previews
```

This writes one `.html` and one `.txt` per kind to `.git/runs/email-previews/`. Open the HTML files in a browser.

To exercise the cron locally with no key, set `CRON_SECRET` in `.env.local`, leave `RESEND_API_KEY` empty, start `npm run dev`, and call the route. The log prints `email skipped ...` per recipient and `email_log` fills with `skipped` rows.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
```

`npm test` covers the Boise day math across both DST changes, recipient selection by status, idempotency on a second run, the no-key skip path, the waitlist count and dedupe, and a render of every template.
