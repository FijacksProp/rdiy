import { config } from "./config.js";

const MONIME_API_URL = "https://api.monime.io/v1";

interface Money {
  currency: string;
  value: number;
}

interface MonimeEnvelope<T> {
  success?: boolean;
  messages?: unknown[];
  result?: T;
}

export interface MonimeCheckoutSession {
  id: string;
  status?: string;
  reference?: string;
  redirectUrl?: string;
  orderNumber?: string;
  lineItems?: { data?: Array<{ price?: Money }> };
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutInput {
  reference: string;
  amountMinor: number;
  purposeLabel: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export class MonimeConfigurationError extends Error {}
export class MonimeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function credentials(): { token: string; spaceId: string } {
  const token = config.monimeAccessToken();
  const spaceId = config.monimeSpaceId();
  if (!token || !spaceId) {
    throw new MonimeConfigurationError("Monime payments are not configured yet.");
  }
  return { token, spaceId };
}

export function isMonimeConfigured(): boolean {
  return Boolean(config.monimeAccessToken() && config.monimeSpaceId());
}

export function toMinorUnits(amount: number): number {
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(amount * 100 - minor) > 0.000001) {
    throw new Error("Donation amounts must have no more than two decimal places.");
  }
  return minor;
}

function messageFrom(body: MonimeEnvelope<unknown>, fallback: string): string {
  const first = body.messages?.find((message) => typeof message === "string");
  return typeof first === "string" && first.trim() ? first : fallback;
}

async function monimeRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { token, spaceId } = credentials();
  const response = await fetch(`${MONIME_API_URL}${path}`, {
    ...init,
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`,
      "Monime-Space-Id": spaceId,
      "Monime-Version": config.monimeApiVersion(),
      ...init.headers
    },
    signal: AbortSignal.timeout(8_000)
  });

  let body: MonimeEnvelope<T>;
  try {
    body = await response.json() as MonimeEnvelope<T>;
  } catch {
    throw new MonimeApiError("Monime returned an unreadable response.", response.status);
  }

  if (!response.ok || body.success === false || !body.result) {
    throw new MonimeApiError(messageFrom(body, "Monime could not complete the payment request."), response.status);
  }
  return body.result;
}

function paymentOptions(): Record<string, unknown> {
  const momoProviders = config.monimeMomoProviders();
  const bankProviders = config.monimeBankProviders();

  return {
    card: { disable: false },
    bank: {
      disable: false,
      ...(bankProviders.length ? { enabledProviders: bankProviders } : {})
    },
    momo: {
      disable: false,
      ...(momoProviders.length ? { enabledProviders: momoProviders } : {})
    },
    wallet: { disable: true }
  };
}

export async function createMonimeCheckout(input: CreateCheckoutInput): Promise<MonimeCheckoutSession> {
  const financialAccountId = config.monimeFinancialAccountId();
  return monimeRequest<MonimeCheckoutSession>("/checkout-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey
    },
    body: JSON.stringify({
      name: `RDIY donation ${input.reference}`,
      lineItems: [{
        name: "Donation to RDIY",
        price: { currency: "SLE", value: input.amountMinor },
        type: "custom",
        quantity: 1,
        reference: input.reference,
        description: input.purposeLabel
      }],
      description: `Donation to Restoration and Development Initiative for Youth (${input.reference})`,
      cancelUrl: input.cancelUrl,
      successUrl: input.successUrl,
      callbackState: input.reference,
      reference: input.reference,
      ...(financialAccountId ? { financialAccountId } : {}),
      paymentOptions: paymentOptions(),
      brandingOptions: { primaryColor: "#137a3a" },
      metadata: { rdiyReference: input.reference, purpose: input.purposeLabel }
    })
  });
}

export function getMonimeCheckout(sessionId: string): Promise<MonimeCheckoutSession> {
  return monimeRequest<MonimeCheckoutSession>(`/checkout-sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET"
  });
}

export function normalizeMonimeStatus(status: string | undefined): "pending" | "completed" | "failed" | "cancelled" | "expired" {
  switch (status?.toLowerCase()) {
    case "completed":
    case "successful":
    case "succeeded":
    case "paid":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}
