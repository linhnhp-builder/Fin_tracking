# FinTrack AI — Architecture Overview

> **Purpose:** This document is the primary context file for AI coding assistants (Cursor, GitHub Copilot, etc.). Read this first before making any changes to the codebase.

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, shadcn/ui | Vite build, Wouter routing (not React Router) |
| **Backend** | Express 4, tRPC 11, Node.js (ESM) | Superjson serialization, no REST endpoints |
| **Database** | PostgreSQL (Supabase) + Drizzle ORM | Migrations under `supabase/migrations`, `npm run db:migrate` |
| **Authentication** | JWT session cookie + `protectedProcedure` | OAuth wiring lives in `server/_core/oauth.ts` (plug in your provider) |
| **AI/LLM** | OpenAI-compatible API | e.g. `OPENAI_API_KEY` — see `server/routers.ts` / `docs/ai/known-issues.md` |
| **File Storage** | AWS S3 (optional) | `storagePut` / `storageGet` in `server/storage.ts` |
| **Hosting** | Self-hosted / your platform | Vite static build + Node server (`npm run build` / `npm start`) |

---

## Project Structure

```
fintrack-ai/
├── client/src/
│   ├── pages/           ← Feature pages (one per domain)
│   ├── components/      ← Shared UI components (DashboardLayout, shadcn/ui)
│   ├── lib/
│   │   └── utils.ts     ← Shared utilities (formatVND, formatDate, etc.)
│   ├── App.tsx          ← Route definitions (Wouter Switch)
│   └── index.css        ← Global design tokens (CSS variables)
├── server/
│   ├── routers.ts       ← ALL tRPC procedures (single file, ~600 lines)
│   ├── db.ts            ← ALL database query helpers (~400 lines)
│   └── _core/           ← Framework plumbing (DO NOT EDIT)
├── drizzle/
│   └── schema.ts        ← Single source of truth for all DB tables
├── shared/
│   ├── const.ts         ← App-wide constants (COOKIE_NAME, timeouts)
│   ├── types.ts         ← Re-exports all Drizzle inferred types
│   └── date/index.ts    ← Date utilities (shared between client/server)
│   └── currency/index.ts← Currency utilities (shared between client/server)
├── docs/ai/             ← AI assistant context files (this folder)
└── .cursorrules         ← Cursor AI configuration
```

---

## Domain-Named Module Architecture

The codebase is organized by **8 feature domains**. Each domain spans schema → db helpers → router procedures → UI page:

### `auth` domain
- **Schema:** `users` table
- **DB helpers:** `upsertUser`, `getUserByOpenId`
- **Router:** `auth.me`, `auth.logout`
- **UI:** No dedicated page — handled by `DashboardLayout` auth guard
- **Flow:** OAuth (if configured) → `/api/oauth/callback` → JWT cookie → `protectedProcedure`

### `category` domain
- **Schema:** `categories` + `budget_limits` tables
- **DB helpers:** `getCategoriesByUser`, `createCategory`, `updateCategory`, `softDeleteCategory`, `upsertBudgetLimit`, `getBudgetLimitsForUser`, `recalcBudgetSpent`, `recalcAllBudgetsForUser`
- **Router:** `category.list`, `category.create`, `category.update`, `category.delete`, `category.upsertBudget`, `category.seedTemplates`, `category.recalcBudgets`
- **UI:** `client/src/pages/Categories.tsx`
- **Key logic:** Color engine — `pctUsed` determines `colorStatus` (green/yellow/orange/red). Auto-recalc on mount and after every transaction mutation.

### `transaction` domain
- **Schema:** `transactions` table
- **DB helpers:** `getTransactionsByUser`, `createTransaction`, `softDeleteTransaction`
- **Router:** `transaction.list`, `transaction.create`, `transaction.delete`
- **UI:** `client/src/pages/Transactions.tsx`
- **Key logic:** Soft delete only (`isDeleted = true`). After create/delete, always call `category.recalcBudgets` to keep budget totals fresh.

### `ai` domain
- **Schema:** `ai_conversations` + `ai_prompt_configs` tables
- **DB helpers:** `getAiConversationHistory`, `saveAiConversation`, `getActivePrompt`, `seedDefaultPrompt`
- **Router:** `ai.chat`, `ai.history`
- **UI:** `client/src/pages/AIChat.tsx`
- **Key logic:** 4 intents — `RECORD` (save transaction), `QUERY` (fetch DB stats), `MARKET` (gold/silver prices), `UNCLEAR`. System prompt injected with user's categories at runtime. See `docs/ai/known-issues.md` for historical AI API notes.

### `investment` domain
- **Schema:** `investments` + `investment_transactions` tables
- **DB helpers:** `getInvestmentsByUser`, `createInvestment`, `updateInvestment`, `softDeleteInvestment`, `createInvestmentTransaction`, `getInvestmentTransactions`
- **Router:** `investment.list`, `investment.create`, `investment.update`, `investment.delete`, `investment.addTransaction`
- **UI:** `client/src/pages/Investments.tsx`
- **Key logic:** 4 asset types: `gold`, `silver`, `savings`, `lending`. Lending uses period-based interest (week/month/year). P&L for gold/silver is calculated client-side using **brand-specific buy prices** from `market_brand_prices` (manual UI input), with a fallback to cached `market.prices`/`price_snapshots` values when brand prices are missing.

### `market` domain
- **Schema:** `price_snapshots` table + `market_brand_prices` table
- **DB helpers:** `getLatestPrices`, `savePriceSnapshot`, `getLatestBrandPrices`, `upsertMarketBrandPrices`
- **Router:** `market.prices`, `market.brandPrices`, `market.updateBrandPrices`, `market.calcSavings`
- **UI:** Used by Dashboard ticker and Investments page (brand-price inputs + P&L)
- **Key logic:**
  - `price_snapshots`: 5-minute TTL cache for auto market prices
  - `market_brand_prices`: store manual “buy price per brand” for gold/silver (used by UI to calculate current value and P&L)
  - `calcSavings` supports week/month/year term units.

### `report` domain
- **Schema:** Cross-domain queries on `transactions` + `categories` + `budget_limits`
- **DB helpers:** `getMonthlySpendingByCategory`, `getMonthlyIncomeTotals`
- **Router:** `report.monthly`, `report.yoy`, `report.budgetStatus`
- **UI:** `client/src/pages/Reports.tsx`
- **Key logic:** All queries filter by `userId` and `isDeleted = false`. Date filtering uses `transactionDate` varchar field (YYYY-MM-DD format).

### `dashboard` domain
- **Schema:** Aggregates data from all domains
- **Router:** No dedicated router — Dashboard page calls `category.list`, `transaction.list`, `investment.list`, `market.prices`, `report.monthly` directly
- **UI:** `client/src/pages/Dashboard.tsx`
- **Key logic:** Budget widgets, investment summary, market ticker, recent transactions.

---

## Data Flow: AI Chat → Transaction

```
User types Vietnamese text
  → trpc.ai.chat.mutate({ message, sessionId })
  → server: seedDefaultPrompt() → inject user categories
  → callAI(systemPrompt, userMessage)
  → AI returns JSON: { intent, transaction, queryType, response }
  → server: parse JSON, match category (5-strategy fuzzy)
  → return { intent, transaction, categoryId, allCategories, response }
  → client: show ConfirmCard if intent === "RECORD"
  → user clicks "Xác nhận ghi"
  → trpc.transaction.create.mutate({ ...transaction, categoryId })
  → server: createTransaction() → recalcBudgetSpent()
  → client: invalidate transaction.list + category.list
```

---

## Data Flow: Budget Color Engine

```
Transaction created/deleted
  → recalcBudgetSpent(categoryId)
  → SELECT SUM(amount) WHERE categoryId AND month = current AND isDeleted = false
  → pctUsed = spent / budgetAmount * 100
  → colorStatus = green (<60%) | yellow (60-85%) | orange (85-100%) | red (>100%)
  → UPDATE budget_limits SET spentAmount, pctUsed, colorStatus
  → category.list returns updated colorStatus to UI
  → CategoryCard renders progress bar with matching color
```

---

## Authentication Pattern

```typescript
// Protected procedure (requires login)
protectedProcedure.query(({ ctx }) => {
  const userId = ctx.user.id;  // Always available in protected procedures
  // ...
});

// Frontend auth check
const { user, isAuthenticated, loading } = useAuth();
```

---

## Key Constraints

- **No REST endpoints** — all data fetching goes through tRPC procedures
- **Soft delete only** — never hard-delete rows; always set `isDeleted = true`
- **Dates as varchar(10)** — all date fields store `YYYY-MM-DD` strings, not Date objects
- **Decimal as string** — Drizzle returns `decimal` columns as strings; always `Number()` before arithmetic
- **UTC timestamps** — `createdAt`/`updatedAt` are UTC; convert to local timezone for display
