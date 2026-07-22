import { config } from "./config.js";
import type { VercelRequest, VercelResponse } from "./vercel.js";

export interface ApiResult {
  ok: boolean;
  message: string;
  [key: string]: unknown;
}

export function sendJson(response: VercelResponse, status: number, body: ApiResult): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(status).json(body);
}

export function requirePost(request: VercelRequest, response: VercelResponse): boolean {
  if (request.method === "POST") return true;

  response.setHeader("Allow", "POST");
  sendJson(response, 405, { ok: false, message: "Method not allowed." });
  return false;
}

export function hasAcceptableSize(request: VercelRequest, response: VercelResponse): boolean {
  const rawLength = request.headers["content-length"];
  const contentLength = typeof rawLength === "string" ? Number.parseInt(rawLength, 10) : 0;

  if (!Number.isNaN(contentLength) && contentLength <= 20_000) return true;

  sendJson(response, 413, { ok: false, message: "The submitted form is too large." });
  return false;
}

export function hasAllowedOrigin(request: VercelRequest, response: VercelResponse): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;

  const forwardedHost = request.headers["x-forwarded-host"];
  const host = typeof forwardedHost === "string" ? forwardedHost : request.headers.host;
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProtocol === "string" ? forwardedProtocol : "https";
  const sameOrigin = host ? `${protocol}://${host}` : null;
  const allowedOrigins = new Set(config.allowedOrigins());
  if (sameOrigin) allowedOrigins.add(sameOrigin);

  if (allowedOrigins.has(origin)) return true;

  sendJson(response, 403, { ok: false, message: "This submission origin is not allowed." });
  return false;
}

export function readBody(request: VercelRequest): unknown {
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body) as unknown;
    } catch {
      return null;
    }
  }
  return request.body;
}

export function getClientIp(request: VercelRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  if (Array.isArray(forwarded)) return forwarded[0] || "unknown";
  return request.socket.remoteAddress || "unknown";
}

export function preparePost(request: VercelRequest, response: VercelResponse): boolean {
  return requirePost(request, response)
    && hasAcceptableSize(request, response)
    && hasAllowedOrigin(request, response);
}
