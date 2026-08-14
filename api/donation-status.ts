import { findPublicPayment, synchronizeMonimeCheckout } from "../server/payment-status.js";
import { sendJson } from "../server/http.js";
import { consumeRateLimit } from "../server/security.js";
import { donationStatusSchema } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, message: "Method not allowed." });
    return;
  }
  const parsed = donationStatusSchema.safeParse({ reference: request.query.reference });
  if (!parsed.success) {
    sendJson(response, 400, { ok: false, message: "A valid donation reference is required." });
    return;
  }

  try {
    if (!await consumeRateLimit(request, "donation-status", 30, 10 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many payment-status checks. Please wait a few minutes." });
      return;
    }
    const local = await findPublicPayment(parsed.data.reference);
    if (!local) {
      sendJson(response, 404, { ok: false, message: "That online donation could not be found." });
      return;
    }
    let payment = local;
    if (payment.status === "pending") {
      payment = await synchronizeMonimeCheckout(payment.sessionId) ?? payment;
    }
    sendJson(response, 200, {
      ok: true,
      message: "Donation status retrieved.",
      reference: payment.reference,
      status: payment.status
    });
  } catch (error) {
    console.error("Donation status check failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 503, { ok: false, message: "We could not confirm the payment status yet. Please check again shortly." });
  }
}
