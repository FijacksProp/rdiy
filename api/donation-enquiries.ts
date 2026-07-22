import { config } from "../server/config.js";
import { db } from "../server/db.js";
import { sendStaffEmail } from "../server/email.js";
import { preparePost, readBody, sendJson } from "../server/http.js";
import { createDonationReference } from "../server/references.js";
import { consumeRateLimit, isHoneypotTriggered } from "../server/security.js";
import { donationSchema, validationMessage } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;

  try {
    const parsed = donationSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }

    if (isHoneypotTriggered(parsed.data.website)) {
      sendJson(response, 200, { ok: true, message: "Thank you. Your donation enquiry has been recorded." });
      return;
    }

    if (!await consumeRateLimit(request, "donation-enquiry", 5, 30 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many donation enquiries were submitted. Please try again later." });
      return;
    }

    const reference = createDonationReference();
    const sql = db();
    const rows = await sql`
      INSERT INTO donation_enquiries (
        public_reference, full_name, email, phone, intended_amount, currency, purpose, message
      )
      VALUES (
        ${reference}, ${parsed.data.fullName}, ${parsed.data.email}, ${parsed.data.phone},
        ${parsed.data.amount}, 'SLE', ${parsed.data.purpose}, ${parsed.data.message}
      )
      RETURNING id
    `;
    const enquiryId = String(rows[0]?.id);
    const emailStatus = await sendStaffEmail({
      subject: `New RDIY donation enquiry: ${reference}`,
      replyTo: parsed.data.email,
      text: [
        "A new donation enquiry was submitted.",
        "",
        `Reference: ${reference}`,
        `Name: ${parsed.data.fullName}`,
        `Email: ${parsed.data.email}`,
        `Phone: ${parsed.data.phone || "Not provided"}`,
        `Intended amount: ${parsed.data.amount === null ? "Not provided" : `${parsed.data.amount.toFixed(2)} SLE`}`,
        `Purpose: ${parsed.data.purpose}`,
        `Message: ${parsed.data.message || "Not provided"}`,
        "",
        `Record ID: ${enquiryId}`
      ].join("\n")
    });

    await sql`
      UPDATE donation_enquiries
      SET notification_status = ${emailStatus}, updated_at = NOW()
      WHERE id = ${enquiryId}
    `;

    sendJson(response, 201, {
      ok: true,
      message: "Your donation enquiry has been recorded. No payment has been taken.",
      reference,
      instructions: config.donationInstructions()
        || "RDIY will contact you with verified transfer instructions."
    });
  } catch (error) {
    console.error("Donation enquiry failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 500, { ok: false, message: "Your donation enquiry could not be submitted right now." });
  }
}
