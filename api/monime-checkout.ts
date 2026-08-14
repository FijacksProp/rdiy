import { randomUUID } from "node:crypto";
import { db } from "../server/db.js";
import { donationPurposeLabels } from "../server/donations.js";
import { preparePost, readBody, sendJson } from "../server/http.js";
import { createMonimeCheckout, isMonimeConfigured, MonimeApiError, toMinorUnits } from "../server/monime.js";
import { createDonationReference } from "../server/references.js";
import { consumeRateLimit, isHoneypotTriggered } from "../server/security.js";
import { donationSchema, validationMessage } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

function siteUrl(request: VercelRequest): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  if (typeof host !== "string" || typeof protocol !== "string") throw new Error("Unable to determine the public website URL.");
  return `${protocol}://${host}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;
  if (!isMonimeConfigured()) {
    sendJson(response, 503, { ok: false, message: "Secure online donations are being connected. Please use the bank-transfer option for now." });
    return;
  }

  try {
    const parsed = donationSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }
    if (isHoneypotTriggered(parsed.data.website)) {
      sendJson(response, 200, { ok: true, message: "Thank you for supporting RDIY." });
      return;
    }
    if (!await consumeRateLimit(request, "monime-checkout", 5, 30 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many payment attempts were started. Please try again later." });
      return;
    }

    const reference = createDonationReference();
    const idempotencyKey = randomUUID();
    const amountMinor = toMinorUnits(parsed.data.amount);
    const sql = db();
    const rows = await sql`
      WITH enquiry AS (
        INSERT INTO donation_enquiries (
          public_reference, full_name, email, phone, intended_amount, currency, purpose, message, status
        ) VALUES (
          ${reference}, ${parsed.data.fullName}, ${parsed.data.email}, ${parsed.data.phone},
          ${parsed.data.amount}, 'SLE', ${parsed.data.purpose}, ${parsed.data.message}, 'awaiting_payment'
        ) RETURNING id
      )
      INSERT INTO donation_payments (donation_enquiry_id, idempotency_key, amount_minor, currency)
      SELECT id, ${idempotencyKey}, ${amountMinor}, 'SLE' FROM enquiry
      RETURNING id, donation_enquiry_id
    `;
    const paymentId = String(rows[0]?.id);
    const enquiryId = String(rows[0]?.donation_enquiry_id);
    const baseUrl = siteUrl(request);
    const encodedReference = encodeURIComponent(reference);

    try {
      const checkout = await createMonimeCheckout({
        reference,
        amountMinor,
        purposeLabel: donationPurposeLabels[parsed.data.purpose] ?? parsed.data.purpose,
        idempotencyKey,
        successUrl: `${baseUrl}/donate.html?payment=return&reference=${encodedReference}#payment-result`,
        cancelUrl: `${baseUrl}/donate.html?payment=cancelled&reference=${encodedReference}#payment-result`
      });
      if (!checkout.id || !checkout.redirectUrl) throw new Error("Monime did not return a checkout URL.");

      await sql`
        UPDATE donation_payments
        SET checkout_session_id = ${checkout.id}, status = 'pending', updated_at = NOW()
        WHERE id = ${paymentId}
      `;
      sendJson(response, 201, {
        ok: true,
        message: "Your secure checkout is ready.",
        reference,
        checkoutUrl: checkout.redirectUrl
      });
    } catch (error) {
      await sql`UPDATE donation_payments SET status = 'failed', updated_at = NOW() WHERE id = ${paymentId}`;
      await sql`UPDATE donation_enquiries SET status = 'rejected', updated_at = NOW() WHERE id = ${enquiryId}`;
      throw error;
    }
  } catch (error) {
    console.error("Monime checkout failed", error instanceof Error ? error.name : "UnknownError");
    const message = error instanceof MonimeApiError && error.status < 500
      ? "Monime could not start this checkout. Please review the amount or use bank transfer."
      : "Secure checkout could not be started right now. Please try again or use bank transfer.";
    sendJson(response, 502, { ok: false, message });
  }
}
