function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  databaseUrl: () => required("DATABASE_URL"),
  rateLimitSalt: () => required("RATE_LIMIT_SALT"),
  resendApiKey: () => process.env.RESEND_API_KEY?.trim() || null,
  contactToEmail: () => process.env.CONTACT_TO_EMAIL?.trim() || "rdiy.sl.org@gmail.com",
  resendFromEmail: () => process.env.RESEND_FROM_EMAIL?.trim() || "RDIY Website <onboarding@resend.dev>",
  monimeAccessToken: () => process.env.MONIME_ACCESS_TOKEN?.trim() || null,
  monimeSpaceId: () => process.env.MONIME_SPACE_ID?.trim() || null,
  monimeFinancialAccountId: () => process.env.MONIME_FINANCIAL_ACCOUNT_ID?.trim() || null,
  monimeWebhookSecret: () => process.env.MONIME_WEBHOOK_SECRET?.trim() || null,
  monimeApiVersion: () => process.env.MONIME_API_VERSION?.trim() || "caph.2025-08-23",
  monimeMomoProviders: () => (process.env.MONIME_MOMO_PROVIDERS || "m17,m18")
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean),
  monimeBankProviders: () => (process.env.MONIME_BANK_PROVIDERS || "")
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean),
  publicSiteUrl: () => process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || null,
  allowedOrigins: () => (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
