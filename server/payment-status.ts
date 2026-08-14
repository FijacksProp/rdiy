import { db } from "./db.js";
import { combineEmailStatuses, sendDonorEmail, sendStaffEmail } from "./email.js";
import { formatDonationAmount } from "./donations.js";
import { getMonimeCheckout, normalizeMonimeStatus, type MonimeCheckoutSession } from "./monime.js";

export type PublicPaymentStatus = "pending" | "completed" | "failed" | "cancelled" | "expired";

interface PaymentRecord {
  paymentId: string;
  enquiryId: string;
  reference: string;
  fullName: string;
  email: string;
  amount: number;
  amountMinor: number;
  currency: string;
  purpose: string;
  sessionId: string;
  status: PublicPaymentStatus;
}

function checkoutAmountMinor(session: MonimeCheckoutSession): number | null {
  const items = session.lineItems?.data;
  if (!items?.length) return null;
  return items.reduce((sum, item) => sum + (Number(item.price?.value) || 0), 0);
}

async function findBySession(sessionId: string): Promise<PaymentRecord | null> {
  const rows = await db()`
    SELECT
      dp.id AS payment_id, dp.donation_enquiry_id AS enquiry_id,
      dp.amount_minor, dp.currency, dp.checkout_session_id, dp.status,
      de.public_reference, de.full_name, de.email, de.intended_amount, de.purpose
    FROM donation_payments dp
    JOIN donation_enquiries de ON de.id = dp.donation_enquiry_id
    WHERE dp.checkout_session_id = ${sessionId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    paymentId: String(row.payment_id),
    enquiryId: String(row.enquiry_id),
    reference: String(row.public_reference),
    fullName: String(row.full_name),
    email: String(row.email),
    amount: Number(row.intended_amount),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    purpose: String(row.purpose),
    sessionId: String(row.checkout_session_id),
    status: String(row.status) as PublicPaymentStatus
  };
}

async function sendReceiptOnce(payment: PaymentRecord): Promise<void> {
  const sql = db();
  const claimed = await sql`
    UPDATE donation_payments
    SET receipt_status = 'sending', updated_at = NOW()
    WHERE id = ${payment.paymentId} AND receipt_status = 'pending'
    RETURNING id
  `;
  if (!claimed[0]) return;

  const amount = formatDonationAmount(payment.amount);
  const statuses = await Promise.all([
    sendStaffEmail({
      subject: `Confirmed online donation: ${payment.reference}`,
      replyTo: payment.email,
      text: [
        "Monime has confirmed an online donation.", "",
        `Reference: ${payment.reference}`,
        `Name: ${payment.fullName}`,
        `Email: ${payment.email}`,
        `Amount: ${amount}`,
        `Purpose: ${payment.purpose}`,
        `Monime checkout session: ${payment.sessionId}`
      ].join("\n")
    }),
    sendDonorEmail(payment.email, {
      subject: `Thank you for your RDIY donation: ${payment.reference}`,
      text: [
        `Hello ${payment.fullName},`, "",
        "Thank you for supporting Restoration and Development Initiative for Youth.",
        "Your online donation has been confirmed.", "",
        `Amount: ${amount}`,
        `Donation reference: ${payment.reference}`,
        `Purpose: ${payment.purpose}`, "",
        "Please keep this message for your records.", "",
        "Restoration and Development Initiative for Youth"
      ].join("\n")
    })
  ]);
  const receiptStatus = combineEmailStatuses(statuses);
  await sql`
    UPDATE donation_payments
    SET receipt_status = ${receiptStatus}, updated_at = NOW()
    WHERE id = ${payment.paymentId}
  `;
}

export async function synchronizeMonimeCheckout(sessionId: string): Promise<PaymentRecord | null> {
  const local = await findBySession(sessionId);
  if (!local) return null;

  const remote = await getMonimeCheckout(sessionId);
  const status = normalizeMonimeStatus(remote.status);
  const remoteReference = remote.reference ?? String(remote.metadata?.rdiyReference ?? "");
  const remoteAmount = checkoutAmountMinor(remote);

  if (remoteReference !== local.reference) {
    throw new Error("Monime checkout reference did not match the local donation.");
  }
  if (remoteAmount !== null && remoteAmount !== local.amountMinor) {
    throw new Error("Monime checkout amount did not match the local donation.");
  }

  const enquiryStatus = status === "completed"
    ? "confirmed"
    : status === "cancelled" || status === "expired"
      ? "cancelled"
      : status === "failed"
        ? "rejected"
        : "awaiting_payment";
  const sql = db();
  await sql`
    UPDATE donation_payments
    SET status = ${status}, paid_at = CASE WHEN ${status} = 'completed' THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
        updated_at = NOW()
    WHERE id = ${local.paymentId}
  `;
  await sql`
    UPDATE donation_enquiries
    SET status = ${enquiryStatus}, updated_at = NOW()
    WHERE id = ${local.enquiryId}
  `;

  const updated = { ...local, status };
  if (status === "completed") await sendReceiptOnce(updated);
  return updated;
}

export async function findPublicPayment(reference: string): Promise<PaymentRecord | null> {
  const rows = await db()`
    SELECT dp.checkout_session_id
    FROM donation_payments dp
    JOIN donation_enquiries de ON de.id = dp.donation_enquiry_id
    WHERE de.public_reference = ${reference} AND dp.checkout_session_id IS NOT NULL
    ORDER BY dp.created_at DESC
    LIMIT 1
  `;
  const sessionId = rows[0]?.checkout_session_id ? String(rows[0].checkout_session_id) : null;
  return sessionId ? findBySession(sessionId) : null;
}
