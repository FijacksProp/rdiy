import { describe, expect, it } from "vitest";
import { bankTransferDetails, formatDonationAmount } from "../server/donations.js";
import { combineEmailStatuses } from "../server/email.js";
import { normalizeMonimeStatus, toMinorUnits } from "../server/monime.js";

describe("guided bank transfers", () => {
  it("uses the verified RDIY Ecobank details", () => {
    expect(bankTransferDetails).toEqual({
      bankName: "Ecobank",
      accountName: "Restoration and development initiative for youth",
      accountNumber: "6340047188",
      currency: "SLE"
    });
  });

  it("formats the donor amount without changing its value", () => {
    expect(formatDonationAmount(250)).toBe("250.00 SLE");
  });

  it("records aggregate email delivery failures conservatively", () => {
    expect(combineEmailStatuses(["sent", "sent"])).toBe("sent");
    expect(combineEmailStatuses(["not_configured", "not_configured"])).toBe("not_configured");
    expect(combineEmailStatuses(["sent", "failed"])).toBe("failed");
  });
});

describe("Monime payments", () => {
  it("converts SLE amounts to integer minor units", () => {
    expect(toMinorUnits(1)).toBe(100);
    expect(toMinorUnits(250.75)).toBe(25_075);
    expect(() => toMinorUnits(1.001)).toThrow(/two decimal places/);
  });

  it("normalizes remote checkout states conservatively", () => {
    expect(normalizeMonimeStatus("completed")).toBe("completed");
    expect(normalizeMonimeStatus("cancelled")).toBe("cancelled");
    expect(normalizeMonimeStatus("expired")).toBe("expired");
    expect(normalizeMonimeStatus("processing")).toBe("pending");
    expect(normalizeMonimeStatus(undefined)).toBe("pending");
  });
});
