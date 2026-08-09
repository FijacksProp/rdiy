import { describe, expect, it } from "vitest";
import { bankTransferDetails, formatDonationAmount } from "../server/donations.js";
import { combineEmailStatuses } from "../server/email.js";

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
