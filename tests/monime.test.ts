import { afterEach, describe, expect, it, vi } from "vitest";
import { createMonimeCheckout } from "../server/monime.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.MONIME_ACCESS_TOKEN;
  delete process.env.MONIME_SPACE_ID;
  delete process.env.MONIME_PAYMENT_METHODS;
  delete process.env.MONIME_MOMO_PROVIDERS;
});

describe("Monime checkout API client", () => {
  it("keeps credentials server-side and creates a restricted hosted checkout", async () => {
    process.env.MONIME_ACCESS_TOKEN = "mon_test_example";
    process.env.MONIME_SPACE_ID = "spc-example";
    process.env.MONIME_PAYMENT_METHODS = "momo";
    process.env.MONIME_MOMO_PROVIDERS = "m17";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      result: { id: "chk-example", redirectUrl: "https://checkout.monime.io/example" }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMonimeCheckout({
      reference: "RDIY-2026-A1B2C3",
      amountMinor: 25_000,
      purposeLabel: "General support",
      successUrl: "https://rdiy.example/donate.html?payment=return",
      cancelUrl: "https://rdiy.example/donate.html?payment=cancelled",
      idempotencyKey: "9c2a8750-4637-4bdf-a62b-0663d4b6b803"
    });

    expect(result.redirectUrl).toBe("https://checkout.monime.io/example");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.monime.io/v1/checkout-sessions");
    expect(init.headers).toMatchObject({
      "Authorization": "Bearer mon_test_example",
      "Monime-Space-Id": "spc-example",
      "Idempotency-Key": "9c2a8750-4637-4bdf-a62b-0663d4b6b803"
    });
    const body = JSON.parse(String(init.body)) as Record<string, any>;
    expect(body.lineItems[0].price).toEqual({ currency: "SLE", value: 25_000 });
    expect(body.paymentOptions.momo).toEqual({ disable: false, enabledProviders: ["m17"] });
    expect(body.paymentOptions.bank.disable).toBe(true);
    expect(body.paymentOptions.card.disable).toBe(true);
  });
});
