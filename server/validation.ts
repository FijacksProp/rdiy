import { z } from "zod";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default("");
const honeypot = z.string().max(200).optional().default("");

const contactTypes = [
  "general-inquiry",
  "partnership",
  "collaboration",
  "donation-support",
  "volunteering",
  "media-request"
] as const;

export const contactSchema = z.object({
  contactType: z.enum(contactTypes),
  fullName: trimmed(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: optionalText(30),
  organizationName: optionalText(160),
  organizationRole: optionalText(120),
  partnershipFocus: z.enum(["funding", "program-delivery", "corporate-sponsorship", "technical-support", "other"]).optional(),
  collaborationFocus: z.enum(["community-outreach", "training", "research", "advocacy", "other"]).optional(),
  donationTopic: z.enum(["how-to-donate", "bank-transfer", "existing-donation", "receipt", "other"]).optional(),
  donationReference: optionalText(30),
  volunteerInterest: z.enum(["program-support", "community-outreach", "professional-skills", "fundraising", "other"]).optional(),
  availability: optionalText(120),
  mediaDeadline: optionalText(20),
  subject: trimmed(120),
  message: trimmed(2400),
  website: honeypot
}).superRefine((data, context) => {
  const requireText = (value: string, path: string, message: string) => {
    if (!value) context.addIssue({ code: "custom", path: [path], message });
  };

  const requireSelection = (value: string | undefined, path: string, message: string) => {
    if (!value) context.addIssue({ code: "custom", path: [path], message });
  };

  if (data.contactType === "partnership") {
    requireText(data.organizationName, "organizationName", "Enter the organization name.");
    requireSelection(data.partnershipFocus, "partnershipFocus", "Select a partnership focus.");
  }

  if (data.contactType === "collaboration") {
    requireText(data.organizationName, "organizationName", "Enter the organization name.");
    requireSelection(data.collaborationFocus, "collaborationFocus", "Select a collaboration area.");
  }

  if (data.contactType === "donation-support") {
    requireSelection(data.donationTopic, "donationTopic", "Select a donation topic.");
  }

  if (data.contactType === "volunteering") {
    requireSelection(data.volunteerInterest, "volunteerInterest", "Select a volunteering interest.");
  }

  if (data.contactType === "media-request") {
    requireText(data.organizationName, "organizationName", "Enter the organization or media outlet.");
  }
});

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  consent: z.literal("yes"),
  website: honeypot
});

export const donationSchema = z.object({
  fullName: trimmed(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: optionalText(30),
  amount: z.preprocess(
    (value) => value === "" || value === undefined ? Number.NaN : Number(value),
    z.number().positive().max(100_000_000)
  ),
  purpose: z.enum(["general", "skills-development", "rehabilitation", "entrepreneurship", "agriculture"]),
  message: optionalText(2000),
  website: honeypot
});

export const donationConfirmationSchema = z.object({
  donationReference: z.string().trim().toUpperCase().regex(/^RDIY-\d{4}-[A-F0-9]{6}$/),
  provider: z.literal("bank-transfer"),
  transactionReference: trimmed(120),
  senderName: trimmed(120),
  website: honeypot
});

export const unsubscribeSchema = z.object({
  token: z.string().trim().min(32).max(200)
});

export function validationMessage(): string {
  return "Please review the form and provide valid information.";
}
