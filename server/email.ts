import { Resend } from "resend";
import { config } from "./config.js";

interface StaffEmail {
  subject: string;
  text: string;
  replyTo?: string;
}

export type EmailStatus = "sent" | "not_configured" | "failed";

interface RecipientEmail extends StaffEmail {
  to: string;
}

async function sendEmail(message: RecipientEmail): Promise<EmailStatus> {
  const apiKey = config.resendApiKey();
  if (!apiKey) return "not_configured";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: config.resendFromEmail(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo
    });

    return error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}

export function sendStaffEmail(message: StaffEmail): Promise<EmailStatus> {
  return sendEmail({ ...message, to: config.contactToEmail() });
}

export function sendDonorEmail(to: string, message: StaffEmail): Promise<EmailStatus> {
  return sendEmail({
    ...message,
    to,
    replyTo: message.replyTo ?? config.contactToEmail()
  });
}

export function combineEmailStatuses(statuses: EmailStatus[]): EmailStatus {
  if (statuses.every((status) => status === "sent")) return "sent";
  if (statuses.every((status) => status === "not_configured")) return "not_configured";
  return "failed";
}
