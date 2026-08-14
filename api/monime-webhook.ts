import { timingSafeEqual } from "node:crypto";
import { config } from "../server/config.js";
import { db } from "../server/db.js";
import { readBody, sendJson } from "../server/http.js";
import { synchronizeMonimeCheckout } from "../server/payment-status.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

function secretMatches(received: string | string[] | undefined, expected: string): boolean {
  if (typeof received !== "string") return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function eventPayload(value: unknown): { id: string; name: string; objectId: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const event = body.event as Record<string, unknown> | undefined;
  const object = body.object as Record<string, unknown> | undefined;
  if (typeof event?.id !== "string" || typeof event.name !== "string" || typeof object?.id !== "string") return null;
  return { id: event.id, name: event.name, objectId: object.id };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, message: "Method not allowed." });
    return;
  }
  const webhookSecret = config.monimeWebhookSecret();
  if (!webhookSecret) {
    sendJson(response, 503, { ok: false, message: "Webhook is not configured." });
    return;
  }
  if (!secretMatches(request.headers["x-rdiy-webhook-secret"], webhookSecret)) {
    sendJson(response, 401, { ok: false, message: "Invalid webhook authentication." });
    return;
  }

  const event = eventPayload(readBody(request));
  if (!event) {
    sendJson(response, 400, { ok: false, message: "Invalid webhook event." });
    return;
  }
  if (!event.name.startsWith("checkout_session.")) {
    sendJson(response, 200, { ok: true, message: "Event ignored." });
    return;
  }

  try {
    const alreadyProcessed = await db()`SELECT event_id FROM monime_webhook_events WHERE event_id = ${event.id}`;
    if (alreadyProcessed[0]) {
      sendJson(response, 200, { ok: true, message: "Event already processed." });
      return;
    }

    const payment = await synchronizeMonimeCheckout(event.objectId);
    if (!payment) {
      sendJson(response, 404, { ok: false, message: "Checkout session was not recognized." });
      return;
    }
    await db()`
      INSERT INTO monime_webhook_events (event_id, event_name, object_id)
      VALUES (${event.id}, ${event.name}, ${event.objectId})
      ON CONFLICT (event_id) DO NOTHING
    `;
    sendJson(response, 200, { ok: true, message: "Webhook processed." });
  } catch (error) {
    console.error("Monime webhook failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 503, { ok: false, message: "Webhook processing will need to be retried." });
  }
}
