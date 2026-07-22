import { db } from "../server/db.js";
import { sendStaffEmail } from "../server/email.js";
import { preparePost, readBody, sendJson } from "../server/http.js";
import { createUnsubscribeToken } from "../server/references.js";
import { consumeRateLimit, isHoneypotTriggered } from "../server/security.js";
import { newsletterSchema, validationMessage } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;

  try {
    const parsed = newsletterSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }

    if (isHoneypotTriggered(parsed.data.website)) {
      sendJson(response, 200, { ok: true, message: "Thank you. Your subscription request has been recorded." });
      return;
    }

    if (!await consumeRateLimit(request, "newsletter", 5, 60 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many subscription attempts were made. Please try again later." });
      return;
    }

    const { hash } = createUnsubscribeToken();
    const sql = db();
    await sql`
      INSERT INTO newsletter_subscribers (email, unsubscribe_token_hash)
      VALUES (${parsed.data.email}, ${hash})
      ON CONFLICT ((lower(email))) DO UPDATE SET
        status = CASE
          WHEN newsletter_subscribers.status = 'suppressed' THEN 'suppressed'
          ELSE 'pending'
        END,
        consented_at = NOW(),
        unsubscribed_at = NULL,
        unsubscribe_token_hash = CASE
          WHEN newsletter_subscribers.status = 'suppressed' THEN newsletter_subscribers.unsubscribe_token_hash
          ELSE EXCLUDED.unsubscribe_token_hash
        END,
        updated_at = NOW()
    `;

    await sendStaffEmail({
      subject: "New RDIY newsletter signup",
      text: `A visitor requested RDIY newsletter updates.\n\nEmail: ${parsed.data.email}\nStatus: Pending confirmation`
    });

    sendJson(response, 201, {
      ok: true,
      message: "Your subscription request has been recorded. Newsletter delivery will begin after email confirmation is configured."
    });
  } catch (error) {
    console.error("Newsletter signup failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 500, { ok: false, message: "Your subscription request could not be recorded right now." });
  }
}
