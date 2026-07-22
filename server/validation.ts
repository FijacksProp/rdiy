import { z } from "zod";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().default("");
const honeypot = z.string().max(200).optional().default("");

export const contactSchema = z.object({
  fullName: trimmed(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  phone: optionalText(30),
  subject: trimmed(160),
  message: trimmed(3000),
  website: honeypot
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
    (value) => value === "" || value === undefined ? null : Number(value),
    z.number().positive().max(100_000_000).nullable()
  ),
  purpose: z.enum(["general", "skills-development", "rehabilitation", "entrepreneurship", "agriculture"]),
  message: optionalText(2000),
  website: honeypot
});

export const donationConfirmationSchema = z.object({
  donationReference: z.string().trim().toUpperCase().regex(/^RDIY-\d{4}-[A-F0-9]{6}$/),
  provider: z.enum(["orange-money", "afrimoney", "bank-transfer", "other"]),
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
