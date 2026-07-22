function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  databaseUrl: () => required("DATABASE_URL"),
  rateLimitSalt: () => required("RATE_LIMIT_SALT"),
  resendApiKey: () => process.env.RESEND_API_KEY?.trim() || null,
  contactToEmail: () => process.env.CONTACT_TO_EMAIL?.trim() || "info.rdiy@gmail.com",
  resendFromEmail: () => process.env.RESEND_FROM_EMAIL?.trim() || "RDIY Website <onboarding@resend.dev>",
  donationInstructions: () => process.env.DONATION_INSTRUCTIONS?.trim() || null,
  allowedOrigins: () => (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
