# RDIY website

The Restoration & Development Initiative for Youth website is a Vercel-native multi-page TypeScript application.

## Architecture

- Vite builds the six static HTML pages and browser TypeScript.
- Vercel Functions under `api/` process public forms.
- Neon PostgreSQL stores messages, newsletter requests, donation records, payment states, transfer reports, and rate-limit counters.
- Resend sends staff notifications and donor acknowledgements after records have been stored.
- Monime provides hosted online checkout and verified payment status. Guided, staff-verified Ecobank transfers remain available as a fallback.

## Requirements

- Node.js 22 or newer
- A Vercel account
- A Neon PostgreSQL project
- An optional Resend account for notifications

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env.local` and replace every placeholder.

3. Open the Neon SQL Editor and run `database/001_initial.sql`, then `database/002_monime_payments.sql`, once each and in that order.

4. Start the frontend development server:

   ```sh
   npm run dev
   ```

5. Use Vercel's CLI when testing the API routes locally:

   ```sh
   npx vercel dev
   ```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon pooled PostgreSQL connection string |
| `RATE_LIMIT_SALT` | Yes | Secret used to hash visitor IPs before rate-limit storage |
| `RESEND_API_KEY` | No | Enables notification email delivery |
| `CONTACT_TO_EMAIL` | No | Staff notification recipient; defaults to `rdiy.sl.org@gmail.com` |
| `RESEND_FROM_EMAIL` | No | Verified sender; defaults to Resend's onboarding sender |
| `ALLOWED_ORIGINS` | No | Extra comma-separated form origins |
| `MONIME_ACCESS_TOKEN` | For online payments | Server-side live Personal Access Token; Monime currently rejects test tokens for Checkout Sessions |
| `MONIME_SPACE_ID` | For online payments | RDIY's Monime Space ID |
| `MONIME_FINANCIAL_ACCOUNT_ID` | No | Specific settlement account; the Space main account is used when omitted |
| `MONIME_WEBHOOK_SECRET` | For online payments | Secret expected in Monime's `x-rdiy-webhook-secret` custom header |
| `MONIME_API_VERSION` | No | Defaults to `caph.2025-08-23` |
| `MONIME_PAYMENT_METHODS` | No | Comma-separated `momo`, `bank`, and/or `card` methods |
| `MONIME_MOMO_PROVIDERS` | No | Optional provider allow-list, such as `m17,m18` |
| `MONIME_BANK_PROVIDERS` | No | Optional Monime bank-provider allow-list |
| `PUBLIC_SITE_URL` | Production | Canonical HTTPS origin used for checkout return URLs |

Never prefix server secrets with `VITE_`; Vite-prefixed variables are exposed to browsers.

## Resend free-mode behavior

When using `onboarding@resend.dev`, Resend only delivers to the email address associated with the Resend account. Register Resend with the RDIY notification address and use that same address for `CONTACT_TO_EMAIL`.

The database remains the source of truth. If Resend is unconfigured or fails, submissions stay stored with a corresponding notification status.

Newsletter signups remain `pending` until RDIY owns and verifies a sending domain and implements confirmation emails. Do not export or send campaigns to pending subscribers.

## Online donation workflow

1. The donor enters their details and SLE amount.
2. `/api/monime-checkout` creates a non-sequential RDIY reference, stores an initializing payment, and requests a hosted Monime Checkout Session.
3. The donor completes payment on Monime; the RDIY website never receives payment credentials.
4. Monime sends a checkout event to `/api/monime-webhook` using the configured custom authentication header.
5. RDIY retrieves the checkout directly from Monime and validates its reference, amount, and status before updating Neon.
6. A confirmed donation triggers one donor receipt and one staff notification through Resend.
7. The return page polls `/api/donation-status` so a donor can still see confirmation if webhook delivery is delayed.

## Monime webhook configuration

After deploying, create a webhook in the RDIY Monime Space:

- URL: `https://YOUR_DOMAIN/api/monime-webhook`
- Events: `checkout_session.completed`, `checkout_session.cancelled`, `checkout_session.expired`
- Custom header name: `x-rdiy-webhook-secret`
- Custom header value: exactly the same random value as `MONIME_WEBHOOK_SECRET`
- Alert email: the RDIY operations email

The endpoint does not trust event data by itself. It uses the server-side Monime token to retrieve the checkout and compare the reference and amount before confirmation. Event IDs are stored to make retries idempotent.

Although Monime issues `mon_test_` tokens, its live API returned `access_denied` for `/v1/checkout-sessions` in test mode as verified on August 14, 2026. Validate the integration first with read-only live API access, then create and cancel a hosted checkout before performing one deliberately small real payment. Creating a checkout session does not itself authorize a payment.

## Manual bank-transfer fallback

The donor can choose **Use Direct Bank Transfer Instead**. That existing workflow creates a reference, displays the verified Ecobank details, accepts a transfer report, and leaves it pending for staff verification.

The public receiving details live in `server/donations.ts`. Never add online-banking credentials, PINs, card information, CVVs, OTPs, API secrets, or any private bank credential there.

## Commands

```sh
npm run typecheck
npm test
npm run build
npm run check
```

## Vercel deployment

1. Import the repository into Vercel.
2. Keep the detected build command as `npm run build` and output directory as `dist`.
3. Add the production environment variables in Vercel Project Settings.
4. Run the database migration before enabling the forms.
5. Deploy and test `/api/health`, then submit one record through each form.

The Content Security Policy and other baseline response headers are configured in `vercel.json`.

## Staff operations

The initial zero-cost release uses the Neon dashboard as the restricted staff data interface. Do not share database credentials broadly. A dedicated authenticated admin application should be added before several nontechnical staff members need access.

See `docs/operations.md` for the verification and incident procedures.
