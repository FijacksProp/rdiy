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
      contactType: "general-inquiry",
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

  it("requires a valid contact category", () => {
    const base = {
      fullName: "Example Person",
      email: "person@example.com",
      phone: "",
      subject: "Hello",
      message: "I would like more information.",
      website: ""
    };

    expect(contactSchema.safeParse(base).success).toBe(false);
    expect(contactSchema.safeParse({ ...base, contactType: "general-inquiry" }).success).toBe(true);
  });

  it("requires partnership context only for partnership enquiries", () => {
    const base = {
      contactType: "partnership",
      fullName: "Example Person",
      email: "person@example.com",
      phone: "",
      subject: "Partnership opportunity",
      message: "We would like to discuss working together.",
      website: ""
    };

    expect(contactSchema.safeParse(base).success).toBe(false);
    expect(contactSchema.safeParse({
      ...base,
      organizationName: "Example Foundation",
      partnershipFocus: "program-delivery"
    }).success).toBe(true);
  });

  it("accepts categorized donation support enquiries", () => {
    expect(contactSchema.safeParse({
      contactType: "donation-support",
      fullName: "Example Donor",
      email: "donor@example.com",
      phone: "",
      donationTopic: "existing-donation",
      donationReference: "RDIY-2026-A1B2C3",
      subject: "Transfer question",
      message: "Please help me check my transfer.",
      website: ""
    }).success).toBe(true);
  });

  it("rejects malformed newsletter addresses", () => {
    expect(newsletterSchema.safeParse({ email: "not-an-email", consent: "yes", website: "" }).success).toBe(false);
  });

  it("requires explicit newsletter consent", () => {
    expect(newsletterSchema.safeParse({ email: "reader@example.com", website: "" }).success).toBe(false);
    expect(newsletterSchema.safeParse({ email: "reader@example.com", consent: "yes", website: "" }).success).toBe(true);
  });

  it("requires a positive donation amount", () => {
    const base = {
      fullName: "Donor Name",
      email: "donor@example.com",
      phone: "",
      purpose: "general",
      message: "",
      website: ""
    };

    expect(donationSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(donationSchema.safeParse({ ...base, amount: "-1" }).success).toBe(false);
    expect(donationSchema.safeParse({ ...base, amount: "1.001" }).success).toBe(false);
    expect(donationSchema.parse({ ...base, amount: "250" }).amount).toBe(250);
  });

  it("normalizes valid donation references", () => {
    const result = donationConfirmationSchema.parse({
      donationReference: "rdiy-2026-a1b2c3",
      provider: "bank-transfer",
      transactionReference: "TX-100",
      senderName: "Example Person",
      website: ""
    });

    expect(result.donationReference).toBe("RDIY-2026-A1B2C3");
  });
});
