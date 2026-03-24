import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const roleEnum         = pgEnum("role",         ["user", "admin"]);
export const categoryTypeEnum = pgEnum("category_type",["income", "expense"]);
export const periodEnum       = pgEnum("period",       ["daily", "weekly", "monthly", "yearly"]);
export const colorStatusEnum  = pgEnum("color_status", ["green", "yellow", "orange", "red"]);
export const txTypeEnum       = pgEnum("tx_type",      ["income", "expense"]);
export const sourceEnum       = pgEnum("source",       ["ai_chat", "manual_ui", "recurring"]);
export const assetTypeEnum    = pgEnum("asset_type",   ["gold", "silver", "savings", "lending"]);
export const statusEnum       = pgEnum("status",       ["holding", "sold", "matured"]);
export const invTxTypeEnum    = pgEnum("inv_tx_type",  ["buy", "sell", "interest", "withdrawal"]);
export const roleConvEnum     = pgEnum("role_conv",    ["user", "assistant"]);
export const intentEnum       = pgEnum("intent",       ["RECORD", "QUERY", "MARKET", "UNCLEAR"]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  openId:       text("openId").notNull().unique(),
  /** Legacy column name from early scaffold; optional external id depending on auth provider */
  manusOpenId:  text("manusOpenId"),
  name:         text("name"),
  email:        text("email"),
  loginMethod:  text("loginMethod"),
  role:         text("role").notNull().default("user"),
  createdAt:    timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:    timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id:         serial("id").primaryKey(),
  userId:     integer("userId").notNull(),
  name:       text("name").notNull(),
  type:       text("type").notNull(),
  icon:       text("icon").default("💰"),
  colorHex:   text("colorHex").default("#6B7280"),
  isTemplate: boolean("isTemplate").default(false),
  sortOrder:  integer("sortOrder").default(0),
  isDeleted:  boolean("isDeleted").default(false),
  createdAt:  timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:  timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("categories_userId_idx").on(t.userId)]);

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Budget Limits ────────────────────────────────────────────────────────────
export const budgetLimits = pgTable("budget_limits", {
  id:          serial("id").primaryKey(),
  categoryId:  integer("categoryId").notNull().unique(),
  amount:      numeric("amount", { precision: 15, scale: 0 }).notNull(),
  spent:       numeric("spent",  { precision: 15, scale: 0 }).default("0"),
  period:      text("period").default("monthly"),
  colorStatus: text("colorStatus").default("green"),
  pctUsed:     numeric("pctUsed", { precision: 5, scale: 2 }).default("0"),
  periodStart: text("periodStart"),
  createdAt:   timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type BudgetLimit = typeof budgetLimits.$inferSelect;
export type InsertBudgetLimit = typeof budgetLimits.$inferInsert;

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id:              serial("id").primaryKey(),
  userId:          integer("userId").notNull(),
  categoryId:      integer("categoryId").notNull(),
  type:            text("type").notNull(),
  amount:          numeric("amount", { precision: 15, scale: 0 }).notNull(),
  amountDisplay:   text("amountDisplay").notNull(),
  note:            text("note"),
  locationName:    text("locationName"),
  transactionDate: text("transactionDate").notNull(),
  source:          text("source").default("manual_ui"),
  aiRawInput:      text("aiRawInput"),
  isDeleted:       boolean("isDeleted").default(false),
  createdAt:       timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:       timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("transactions_userId_idx").on(t.userId),
  index("transactions_categoryId_idx").on(t.categoryId),
  index("transactions_date_idx").on(t.transactionDate),
]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Investments ──────────────────────────────────────────────────────────────
export const investments = pgTable("investments", {
  id:            serial("id").primaryKey(),
  userId:        integer("userId").notNull(),
  name:          text("name").notNull(),
  assetType:     text("assetType").notNull(),
  quantity:      numeric("quantity", { precision: 15, scale: 4 }).default("0"),
  unit:          text("unit").default("gram"),
  avgCost:       numeric("avgCost", { precision: 15, scale: 0 }).default("0"),
  totalInvested: numeric("totalInvested", { precision: 15, scale: 0 }).default("0"),
  status:        text("status").default("holding"),
  metadata:      jsonb("metadata"),
  isDeleted:     boolean("isDeleted").default(false),
  createdAt:     timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:     timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("investments_userId_idx").on(t.userId)]);

export type Investment = typeof investments.$inferSelect;
export type InsertInvestment = typeof investments.$inferInsert;

// ─── Investment Transactions ──────────────────────────────────────────────────
export const investmentTransactions = pgTable("investment_transactions", {
  id:           serial("id").primaryKey(),
  investmentId: integer("investmentId").notNull(),
  userId:       integer("userId").notNull(),
  txType:       text("txType").notNull(),
  quantity:     numeric("quantity", { precision: 15, scale: 4 }),
  pricePerUnit: numeric("pricePerUnit", { precision: 15, scale: 0 }),
  amount:       numeric("amount", { precision: 15, scale: 0 }).notNull(),
  note:         text("note"),
  txDate:       text("txDate").notNull(),
  createdAt:    timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("inv_tx_investmentId_idx").on(t.investmentId)]);

export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;
export type InsertInvestmentTransaction = typeof investmentTransactions.$inferInsert;

// ─── Price Snapshots ──────────────────────────────────────────────────────────
export const priceSnapshots = pgTable("price_snapshots", {
  id:        serial("id").primaryKey(),
  assetType: text("assetType").notNull(),
  source:    text("source").default("SJC"),
  buyPrice:  numeric("buyPrice",  { precision: 15, scale: 0 }),
  sellPrice: numeric("sellPrice", { precision: 15, scale: 0 }),
  unit:      text("unit").default("luong"),
  fetchedAt: timestamp("fetchedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("price_snapshots_asset_idx").on(t.assetType, t.fetchedAt)]);

export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type InsertPriceSnapshot = typeof priceSnapshots.$inferInsert;

// ─── Market Brand Prices (Gold/Silver) ───────────────────────────────────────
// Used by UI to allow manual input per brand (e.g. SJC/PNJ for gold, Phú Quý 1kg/1 lượng for silver).
export const marketBrandPrices = pgTable("market_brand_prices", {
  id:        serial("id").primaryKey(),
  assetType: assetTypeEnum("assetType").notNull(),
  brand:     text("brand").notNull(),
  buyPrice:  numeric("buyPrice", { precision: 15, scale: 2 }).notNull(),
  fetchedAt: timestamp("fetchedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("market_brand_prices_asset_brand_idx").on(t.assetType, t.brand)]);

export type MarketBrandPrice = typeof marketBrandPrices.$inferSelect;
export type InsertMarketBrandPrice = typeof marketBrandPrices.$inferInsert;

// ─── AI Conversations ─────────────────────────────────────────────────────────
export const aiConversations = pgTable("ai_conversations", {
  id:        serial("id").primaryKey(),
  userId:    integer("userId").notNull(),
  sessionId: text("sessionId").notNull(),
  role:      text("role").notNull(),
  content:   text("content").notNull(),
  intent:    text("intent"),
  metadata:  jsonb("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("ai_conv_userId_idx").on(t.userId),
  index("ai_conv_sessionId_idx").on(t.sessionId),
]);

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

// ─── AI Prompt Configs ────────────────────────────────────────────────────────
export const aiPromptConfigs = pgTable("ai_prompt_configs", {
  id:         serial("id").primaryKey(),
  promptKey:  text("promptKey").notNull(),
  promptBody: text("promptBody").notNull(),
  version:    integer("version").notNull().default(1),
  isActive:   boolean("isActive").default(true),
  changeNote: text("changeNote"),
  createdAt:  timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  createdBy:  text("createdBy"),
}, (t) => [index("ai_prompt_key_idx").on(t.promptKey, t.isActive)]);

export type AiPromptConfig = typeof aiPromptConfigs.$inferSelect;
export type InsertAiPromptConfig = typeof aiPromptConfigs.$inferInsert;
