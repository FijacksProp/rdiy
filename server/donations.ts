export const bankTransferDetails = Object.freeze({
  bankName: "Ecobank",
  accountName: "Restoration and development initiative for youth",
  accountNumber: "6340047188",
  currency: "SLE"
});

export function formatDonationAmount(amount: number): string {
  return `${amount.toFixed(2)} ${bankTransferDetails.currency}`;
}
