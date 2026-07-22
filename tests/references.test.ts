import { describe, expect, it } from "vitest";
import { createDonationReference, createUnsubscribeToken, hashToken } from "../server/references.js";

describe("public references", () => {
  it("creates non-sequential donation references with the expected year", () => {
    const reference = createDonationReference(new Date("2026-07-22T00:00:00Z"));
    expect(reference).toMatch(/^RDIY-2026-[A-F0-9]{6}$/);
  });

  it("stores only a stable hash of an unsubscribe token", () => {
    const { token, hash } = createUnsubscribeToken();
    expect(token).not.toBe(hash);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
