export const ENV = {
  appId:        process.env.VITE_APP_ID ?? "fintrack-ai",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl:  process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  n8nSjcWebhookUrl: process.env.N8N_SJC_WEBHOOK_URL ?? "",
  n8nSilverWebhookUrl: process.env.N8N_SILVER_WEBHOOK_URL ?? "",
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? "",
};
