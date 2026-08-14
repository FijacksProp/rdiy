export const bankTransferDetails = Object.freeze({
  bankName: "Ecobank",
  accountName: "Restoration and development initiative for youth",
  accountNumber: "6340047188",
  currency: "SLE"
});

export function formatDonationAmount(amount: number): string {
  return `${amount.toFixed(2)} ${bankTransferDetails.currency}`;
}

export const donationPurposeLabels: Record<string, string> = Object.freeze({
  general: "General support",
  "skills-development": "Skills development",
  rehabilitation: "Rehabilitation programmes",
  entrepreneurship: "Youth entrepreneurship",
  agriculture: "Agriculture and food security"
});
