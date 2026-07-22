import { db } from "../server/db.js";
import { sendStaffEmail } from "../server/email.js";
import { preparePost, readBody, sendJson } from "../server/http.js";
import { consumeRateLimit, isHoneypotTriggered } from "../server/security.js";
import { donationConfirmationSchema, validationMessage } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;

  try {
    const parsed = donationConfirmationSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }

    if (isHoneypotTriggered(parsed.data.website)) {
      sendJson(response, 200, { ok: true, message: "Thank you. Your transfer report has been received." });
      return;
    }

    if (!await consumeRateLimit(request, "donation-confirmation", 10, 30 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many transfer reports were submitted. Please try again later." });
      return;
    }

    const sql = db();
    const rows = await sql`
      WITH target AS (
        SELECT id FROM donation_enquiries WHERE public_reference = ${parsed.data.donationReference}
      ), inserted AS (
        INSERT INTO donation_transfer_reports (
          donation_enquiry_id, provider, transaction_reference, sender_name
        )
        SELECT id, ${parsed.data.provider}, ${parsed.data.transactionReference}, ${parsed.data.senderName}
        FROM target
        RETURNING id, donation_enquiry_id
      )
      UPDATE donation_enquiries
      SET status = 'pending_verification', updated_at = NOW()
      WHERE id IN (SELECT donation_enquiry_id FROM inserted)
      RETURNING (SELECT id FROM inserted) AS report_id
    `;

    const reportId = rows[0]?.report_id ? String(rows[0].report_id) : null;
    if (!reportId) {
      sendJson(response, 404, { ok: false, message: "The RDIY donation reference was not found." });
      return;
    }

    const emailStatus = await sendStaffEmail({
      subject: `Donation transfer report: ${parsed.data.donationReference}`,
      text: [
        "A donor reported a manual transfer. This report must be verified against the receiving account.",
        "",
        `RDIY reference: ${parsed.data.donationReference}`,
        `Provider: ${parsed.data.provider}`,
        `Provider transaction reference: ${parsed.data.transactionReference}`,
        `Sender name: ${parsed.data.senderName}`,
        `Report ID: ${reportId}`
      ].join("\n")
    });

    await sql`
      UPDATE donation_transfer_reports
      SET notification_status = ${emailStatus}
      WHERE id = ${reportId}
    `;

    sendJson(response, 201, {
      ok: true,
      message: "Your transfer report has been recorded for manual verification. This is not yet a payment confirmation."
    });
  } catch (error) {
    const errorCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (errorCode === "23505") {
      sendJson(response, 409, { ok: false, message: "That provider transaction reference has already been reported." });
      return;
    }

    console.error("Donation confirmation failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 500, { ok: false, message: "The transfer report could not be submitted right now." });
  }
}
