export const ENV = {
  appId:        process.env.VITE_APP_ID ?? "fintrack-ai",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl:  process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
};
