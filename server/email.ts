import { Resend } from "resend";
import { config } from "./config.js";

interface StaffEmail {
  subject: string;
  text: string;
  replyTo?: string;
}

export type EmailStatus = "sent" | "not_configured" | "failed";

export async function sendStaffEmail(message: StaffEmail): Promise<EmailStatus> {
  const apiKey = config.resendApiKey();
  if (!apiKey) return "not_configured";

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: config.resendFromEmail(),
      to: [config.contactToEmail()],
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo
    });

    return error ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
