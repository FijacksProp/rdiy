# RDIY website

The Restoration & Development Initiative for Youth website is a Vercel-native multi-page TypeScript application.

## Architecture

- Vite builds the six static HTML pages and browser TypeScript.
- Vercel Functions under `api/` process public forms.
- Neon PostgreSQL stores messages, newsletter requests, donation enquiries, transfer reports, and rate-limit counters.
- Resend sends staff notifications and donor acknowledgements after records have been stored.
- Donations use guided, staff-verified bank transfers to RDIY's Ecobank account. The application never collects payment credentials and never marks a reported transfer as confirmed automatically.

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

3. Open the Neon SQL Editor and run `database/001_initial.sql` once.

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

Never prefix server secrets with `VITE_`; Vite-prefixed variables are exposed to browsers.

## Resend free-mode behavior

When using `onboarding@resend.dev`, Resend only delivers to the email address associated with the Resend account. Register Resend with the RDIY notification address and use that same address for `CONTACT_TO_EMAIL`.

The database remains the source of truth. If Resend is unconfigured or fails, submissions stay stored with a corresponding notification status.

Newsletter signups remain `pending` until RDIY owns and verifies a sending domain and implements confirmation emails. Do not export or send campaigns to pending subscribers.

## Donation workflow

1. The donor enters their details and intended SLE amount.
2. The backend creates a non-sequential `RDIY-YEAR-XXXXXX` reference and stores the enquiry as `awaiting_transfer`.
3. The site displays RDIY's verified Ecobank account details and attempts to email the same instructions to the donor.
4. The donor transfers through their own bank app or online banking and uses the RDIY reference as the narration.
5. The donor reports the bank transaction reference on the donation page.
6. The report is stored as `pending_verification`, and staff receives a notification.
7. Staff independently compares the report with the receiving Ecobank statement.
8. Only staff may mark it confirmed directly in Neon until a protected admin interface is added.

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
