# RDIY website operations

## Daily enquiry review

1. Review `contact_messages` records with status `new`.
2. Confirm the message is legitimate before following external links or opening attachments received later by email.
3. Set the status to `read`, `replied`, or `archived` as work progresses.
4. A `failed` or `not_configured` notification status means the database record exists but staff email was not delivered.

## Manual donation verification

1. Find the enquiry by `public_reference`.
2. Review related `donation_transfer_reports`.
3. Sign in to the official receiving bank or mobile-money account independently. Never use a link provided by the donor.
4. Match the actual provider reference, sender, amount, currency, and receipt time.
5. If every value matches, update the report and enquiry to `confirmed` and record the staff verifier and time.
6. If values do not match, mark the report `rejected`; do not disclose internal account information.

A screenshot, SMS, email, or submitted reference is not proof of payment. Only the receiving account statement is authoritative.

## Newsletter handling

- Keep new subscribers in `pending` status until confirmation email delivery is available.
- Send campaigns only to `active` subscribers.
- Never send to `unsubscribed` or `suppressed` records.
- Use BCC only for very small emergency sends; a verified mailing provider is preferred.

## Data retention baseline

These periods must be approved by RDIY leadership and adjusted for applicable law:

- Unneeded contact enquiries: review for deletion after 12 months.
- Newsletter records: retain active consent; retain minimal suppression data after unsubscribe.
- Donation and reconciliation records: retain according to accounting and regulatory requirements.
- Rate-limit records: the application opportunistically deletes records older than two days.

## Incident response

If a secret may have been exposed:

1. Revoke it at Neon, Resend, or Vercel immediately.
2. Create a replacement secret.
3. update the Vercel environment variable and redeploy.
4. Review access and delivery logs.
5. Determine whether personal data was accessed and follow the organization's notification obligations.

Never commit `.env`, `.env.local`, database URLs, API keys, rate-limit salts, wallet credentials, or passwords.
