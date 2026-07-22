import { describe, expect, it } from "vitest";
import {
  contactSchema,
  donationConfirmationSchema,
  donationSchema,
  newsletterSchema
} from "../server/validation.js";

describe("public form validation", () => {
  it("normalizes contact email and trims text", () => {
    const result = contactSchema.parse({
      fullName: "  Example Person  ",
      email: " PERSON@EXAMPLE.COM ",
      phone: "",
      subject: "  Partnership  ",
      message: "  Hello RDIY  ",
      website: ""
    });

    expect(result.fullName).toBe("Example Person");
    expect(result.email).toBe("person@example.com");
    expect(result.subject).toBe("Partnership");
  });

  it("rejects malformed newsletter addresses", () => {
    expect(newsletterSchema.safeParse({ email: "not-an-email", consent: "yes", website: "" }).success).toBe(false);
  });

  it("requires explicit newsletter consent", () => {
    expect(newsletterSchema.safeParse({ email: "reader@example.com", website: "" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ email: "reader@example.com", consent: "yes", website: "" }).success).toBe(true);
  });

  it("accepts a blank donation amount but rejects a negative amount", () => {
    const base = {
      fullName: "Donor Name",
      email: "donor@example.com",
      phone: "",
      purpose: "general",
      message: "",
      website: ""
    };

    expect(donationSchema.parse({ ...base, amount: "" }).amount).toBeNull();
    expect(donationSchema.safeParse({ ...base, amount: "-1" }).success).toBe(false);
  });

  it("normalizes valid donation references", () => {
    const result = donationConfirmationSchema.parse({
      donationReference: "rdiy-2026-a1b2c3",
      provider: "orange-money",
      transactionReference: "TX-100",
      senderName: "Example Person",
      website: ""
    });

    expect(result.donationReference).toBe("RDIY-2026-A1B2C3");
  });
});
