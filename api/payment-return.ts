import { donationStatusSchema } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

function queryValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function handler(request: VercelRequest, response: VercelResponse): void {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    response.statusCode = 405;
    response.end("Method not allowed.");
    return;
  }

  const payment = queryValue(request.query.payment);
  const parsed = donationStatusSchema.safeParse({ reference: queryValue(request.query.reference) });
  const validPayment = payment === "return" || payment === "cancelled";
  const destination = validPayment && parsed.success
    ? `/donate.html?payment=${payment}&reference=${encodeURIComponent(parsed.data.reference)}#payment-result`
    : "/donate.html";

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Location", destination);
  response.statusCode = 303;
  response.end();
}
