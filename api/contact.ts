import { db } from "../server/db.js";
import { sendStaffEmail } from "../server/email.js";
import { preparePost, readBody, sendJson } from "../server/http.js";
import { consumeRateLimit, isHoneypotTriggered } from "../server/security.js";
import { contactSchema, validationMessage } from "../server/validation.js";
import type { VercelRequest, VercelResponse } from "../server/vercel.js";

const contactTypeLabels = {
  "general-inquiry": "General enquiry",
  partnership: "Partnership",
  collaboration: "Collaboration",
  "donation-support": "Donation support",
  volunteering: "Volunteering",
  "media-request": "Media or speaking request"
} as const;

const detailLabels: Record<string, string> = {
  funding: "Funding",
  "program-delivery": "Programme delivery",
  "corporate-sponsorship": "Corporate sponsorship",
  "technical-support": "Technical support",
  "community-outreach": "Community outreach",
  training: "Training",
  research: "Research",
  advocacy: "Advocacy",
  "how-to-donate": "How to donate",
  "bank-transfer": "Bank transfer instructions",
  "existing-donation": "Existing donation",
  receipt: "Donation acknowledgement",
  "program-support": "Programme support",
  "professional-skills": "Professional skills",
  fundraising: "Fundraising",
  other: "Other"
};

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (!preparePost(request, response)) return;

  try {
    const parsed = contactSchema.safeParse(readBody(request));
    if (!parsed.success) {
      sendJson(response, 400, { ok: false, message: validationMessage() });
      return;
    }

    if (isHoneypotTriggered(parsed.data.website)) {
      sendJson(response, 200, { ok: true, message: "Thank you. Your message has been received." });
      return;
    }

    if (!await consumeRateLimit(request, "contact", 5, 10 * 60 * 1000)) {
      sendJson(response, 429, { ok: false, message: "Too many messages were submitted. Please try again later." });
      return;
    }

    const sql = db();
    const typeLabel = contactTypeLabels[parsed.data.contactType];
    const storedSubject = `${typeLabel}: ${parsed.data.subject}`;
    const details = [
      `Contact type: ${typeLabel}`,
      parsed.data.organizationName ? `Organization: ${parsed.data.organizationName}` : null,
      parsed.data.organizationRole ? `Role: ${parsed.data.organizationRole}` : null,
      parsed.data.partnershipFocus ? `Partnership focus: ${detailLabels[parsed.data.partnershipFocus]}` : null,
      parsed.data.collaborationFocus ? `Collaboration area: ${detailLabels[parsed.data.collaborationFocus]}` : null,
      parsed.data.donationTopic ? `Donation topic: ${detailLabels[parsed.data.donationTopic]}` : null,
      parsed.data.donationReference ? `Donation reference: ${parsed.data.donationReference.toUpperCase()}` : null,
      parsed.data.volunteerInterest ? `Volunteering interest: ${detailLabels[parsed.data.volunteerInterest]}` : null,
      parsed.data.availability ? `Availability: ${parsed.data.availability}` : null,
      parsed.data.mediaDeadline ? `Requested response date: ${parsed.data.mediaDeadline}` : null
    ].filter((detail): detail is string => Boolean(detail));
    const storedMessage = [...details, "", parsed.data.message].join("\n");

    const rows = await sql`
      INSERT INTO contact_messages (full_name, email, phone, subject, message)
      VALUES (${parsed.data.fullName}, ${parsed.data.email}, ${parsed.data.phone}, ${storedSubject}, ${storedMessage})
      RETURNING id
    `;
    const messageId = String(rows[0]?.id);
    const emailStatus = await sendStaffEmail({
      subject: `RDIY website enquiry: ${storedSubject}`,
      replyTo: parsed.data.email,
      text: [
        "A new contact enquiry was submitted.",
        "",
        `Name: ${parsed.data.fullName}`,
        `Email: ${parsed.data.email}`,
        `Phone: ${parsed.data.phone || "Not provided"}`,
        `Subject: ${storedSubject}`,
        "",
        storedMessage,
        "",
        `Record ID: ${messageId}`
      ].join("\n")
    });

    await sql`
      UPDATE contact_messages
      SET notification_status = ${emailStatus}, updated_at = NOW()
      WHERE id = ${messageId}
    `;

    sendJson(response, 201, {
      ok: true,
      message: "Thank you. Your message has been received by RDIY."
    });
  } catch (error) {
    console.error("Contact submission failed", error instanceof Error ? error.name : "UnknownError");
    sendJson(response, 500, { ok: false, message: "Your message could not be submitted right now. Please try again later." });
  }
}
