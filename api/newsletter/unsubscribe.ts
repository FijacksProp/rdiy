import { db } from "../../server/db.js";
import { preparePost, readBody, sendJson } from "../../server/http.js";
import { hashToken } from "../../server/references.js";
import { consumeRateLimit } from "../../server/security.js";
import { unsubscribeSchema, validationMessage } from "../../server/validation.js";
import type { VercelRequest, VercelResponse } from "../../server/vercel.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;

  try {
    const parsed = unsubscribeSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }

    if (!await consumeRateLimit(request, "newsletter-unsubscribe", 10, 60 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many attempts were made. Please try again later." });
      return;
    }

    const sql = db();
    await sql`
      UPDATE newsletter_subscribers
      SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW()
      WHERE unsubscribe_token_hash = ${hashToken(parsed.data.token)}
    `;

    sendJson(response, 200, {
      ok: true,
      message: "If the subscription was active, it has now been unsubscribed."
    });
  } catch (error) {
    console.error("Newsletter unsubscribe failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 500, { ok: false, message: "The unsubscribe request could not be completed right now." });
  }
}
