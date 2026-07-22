import { createHmac } from "node:crypto";
import { config } from "./config.js";
import { db } from "./db.js";
import { getClientIp } from "./http.js";
import type { VercelRequest } from "./vercel.js";

export function isHoneypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function consumeRateLimit(
  request: VercelRequest,
  route: string,
  limit: number,
  windowMilliseconds: number
): Promise<boolean> {
  const ipHash = createHmac("sha256", config.rateLimitSalt())
    .update(getClientIp(request))
    .digest("hex");
  const bucketStart = new Date(Math.floor(Date.now() / windowMilliseconds) * windowMilliseconds);
  const sql = db();
  const rows = await sql`
    INSERT INTO api_rate_limits (ip_hash, route, window_start, request_count)
    VALUES (${ipHash}, ${route}, ${bucketStart.toISOString()}, 1)
    ON CONFLICT (ip_hash, route, window_start)
    DO UPDATE SET request_count = api_rate_limits.request_count + 1
    RETURNING request_count
  `;

  const count = Number(rows[0]?.request_count ?? limit + 1);

  if (Math.random() < 0.01) {
    await sql`DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '2 days'`;
  }

  return count <= limit;
}
