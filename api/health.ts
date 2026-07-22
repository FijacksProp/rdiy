import { sendJson } from "../server/http.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

export default function handler(_request: VercelRequest, response: VercelResponse): void {
  sendJson(response, 200, {
    ok: true,
    message: "RDIY API is available.",
    timestamp: new Date().toISOString()
  });
}
