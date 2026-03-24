# FinTrack AI — Data Model

> **Source of truth:** `drizzle/schema.ts`. This document is a human-readable summary for AI assistants. Always check the schema file for exact column types before writing queries.

---

## Entity Relationship Overview

```
users (1) ──────────────────── (N) categories
users (1) ──────────────────── (N) transactions
users (1) ──────────────────── (N) investments
users (1) ──────────────────── (N) ai_conversations
categories (1) ─────────────── (1) budget_limits
categories (1) ─────────────── (N) transactions
investments (1) ────────────── (N) investment_transactions
(global) ───────────────────── (N) price_snapshots
(global) ───────────────────── (N) market_brand_prices
(global) ───────────────────── (N) ai_prompt_configs
```

---

## Table Definitions

### `users`
Core user table backing the OAuth auth flow.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | Surrogate key — use for all foreign key relations |
| `openId` | varchar(64) UNIQUE | External OAuth / identity provider subject id |
| `name` | text | Display name from OAuth |
| `email` | varchar(320) | Email from OAuth |
| `loginMethod` | varchar(64) | e.g. `"oauth"` or provider name |
| `role` | enum(`user`,`admin`) | Default `user`; owner auto-promoted to `admin` |
| `createdAt` | timestamp | UTC, auto-set |
| `updatedAt` | timestamp | UTC, auto-updated |
| `lastSignedIn` | timestamp | Updated on every login |

---

### `categories`
User-defined expense and income categories with visual metadata.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `userId` | int FK → users.id | |
| `name` | varchar(100) | e.g. "Ăn uống", "Lương" |
| `type` | enum(`income`,`expense`) | Determines which budget engine applies |
| `categoryIcon` | varchar(10) | Emoji icon, e.g. `"🍜"` |
| `categoryColor` | varchar(20) | Hex color, e.g. `"#10B981"` |
| `isDeleted` | boolean | Soft delete flag |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Indexes:** `userId`

---

### `budget_limits`
One budget limit per category per period. Tracks spending progress.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `categoryId` | int FK → categories.id UNIQUE | One-to-one with category |
| `userId` | int FK → users.id | Denormalized for fast queries |
| `amount` | decimal(15,0) | Budget ceiling in VNĐ |
| `period` | enum(`monthly`,`weekly`,`yearly`) | Default `monthly` |
| `periodStart` | varchar(10) | YYYY-MM-DD of period start |
| `spentAmount` | decimal(15,0) | Recalculated by `recalcBudgetSpent()` |
| `pctUsed` | decimal(5,2) | `spentAmount / amount * 100` |
| `colorStatus` | enum(`green`,`yellow`,`orange`,`red`) | Derived from `pctUsed` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Color thresholds:** green < 60% ≤ yellow < 85% ≤ orange < 100% ≤ red

---

### `transactions`
All income and expense records. Soft-deleted only.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `userId` | int FK → users.id | |
| `categoryId` | int FK → categories.id | Nullable (uncategorized) |
| `type` | enum(`income`,`expense`) | |
| `amount` | decimal(15,0) | Always positive; type determines direction |
| `note` | text | User note or AI-extracted description |
| `transactionDate` | varchar(10) | **YYYY-MM-DD string** (not a Date object) |
| `location` | varchar(200) | Optional location tag |
| `source` | enum(`ai_chat`,`manual_ui`,`recurring`) | Origin of the record |
| `aiRawInput` | text | Original Vietnamese text if source = `ai_chat` |
| `isDeleted` | boolean | Soft delete flag |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Indexes:** `userId`, `categoryId`, `transactionDate`

---

### `investments`
Investment positions (gold, silver, savings, lending).

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `userId` | int FK → users.id | |
| `name` | varchar(200) | User-defined label, e.g. "Vàng SJC 1 lượng" |
| `assetType` | enum(`gold`,`silver`,`savings`,`lending`) | |
| `quantity` | decimal(15,4) | Amount in asset units (gram, lượng, VNĐ) |
| `unit` | varchar(20) | e.g. `"gram"`, `"luong"`, `"vnd"` |
| `avgCost` | decimal(15,0) | Average cost per unit in VNĐ |
| `totalInvested` | decimal(15,0) | Total capital deployed in VNĐ |
| `status` | enum(`holding`,`sold`,`matured`) | |
| `metadata` | json | Asset-specific data (interest rate, term, lender info) |
| `isDeleted` | boolean | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**`metadata` structure by asset type:**
```json
// savings
{ "interestRate": 7.5, "termMonths": 12, "startDate": "2026-01-01", "maturityDate": "2027-01-01" }

// lending
{ "interestRate": 2.0, "termUnit": "month", "termValue": 6, "startDate": "2026-01-01" }

// gold / silver
{ "purchaseLocation": "SJC Hà Nội" }
```

---

### `investment_transactions`
Buy/sell/interest events for each investment position.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `investmentId` | int FK → investments.id | |
| `userId` | int FK → users.id | |
| `txType` | enum(`buy`,`sell`,`interest`,`withdrawal`) | |
| `quantity` | decimal(15,4) | Units transacted |
| `pricePerUnit` | decimal(15,0) | Price at time of transaction |
| `amount` | decimal(15,0) | Total VNĐ value |
| `note` | text | |
| `txDate` | varchar(10) | YYYY-MM-DD |
| `createdAt` | timestamp | |

**Indexes:** `investmentId`

---

### `price_snapshots`
Cached gold/silver market prices. Refreshed on-demand with 5-minute TTL.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `assetType` | enum(`gold`,`silver`) | |
| `source` | varchar(50) | e.g. `"SJC"`, `"metals.live"` |
| `buyPrice` | decimal(15,0) | Buy price in VNĐ |
| `sellPrice` | decimal(15,0) | Sell price in VNĐ |
| `unit` | varchar(20) | e.g. `"luong"` (37.5g), `"gram"` |
| `fetchedAt` | timestamp | UTC timestamp of fetch |

**Cache logic:** Query latest snapshot; if `fetchedAt` < 5 minutes ago, return cached. Otherwise fetch from external API and insert new row.

**Indexes:** `(assetType, fetchedAt)`

---

### `market_brand_prices`
Manual “buy price per brand” for gold/silver used by the Investments UI.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `assetType` | enum(`gold`,`silver`) | |
| `brand` | text | e.g. `"SJC"`, `"PNJ"`, `"Phú Quý 1kg"`, `"Phú Quý 1 lượng"` |
| `buyPrice` | decimal(15,2) | Manual buy price in VNĐ |
| `fetchedAt` | timestamp | UTC timestamp of the last upsert |

**Uniqueness:** `(assetType, brand)` (upsert target)

---

### `ai_conversations`
Full conversation history for AI Chat sessions.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `userId` | int FK → users.id | |
| `sessionId` | varchar(64) | Client-generated session identifier |
| `role` | enum(`user`,`assistant`) | Message author |
| `content` | text | Message text |
| `intent` | enum(`RECORD`,`QUERY`,`MARKET`,`UNCLEAR`) | Classified intent (nullable for user messages) |
| `metadata` | json | Parsed transaction data, query results, etc. |
| `createdAt` | timestamp | |

**Indexes:** `userId`, `sessionId`

---

### `ai_prompt_configs`
Versioned system prompts for the AI Chat. Allows prompt updates without code deploys.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK auto | |
| `promptKey` | varchar(100) | e.g. `"fintrack_main_v1"` |
| `promptBody` | text | Full system prompt text |
| `version` | int | Monotonically increasing |
| `isActive` | boolean | Only one active prompt per key |
| `changeNote` | text | Reason for this version |
| `createdAt` | timestamp | |
| `createdBy` | varchar(320) | Email of editor |

**Indexes:** `(promptKey, isActive)`

---

## Key Query Patterns

### Get spending by category for current month
```typescript
// In db.ts: getMonthlySpendingByCategory(userId, year, month)
SELECT c.name, c.categoryIcon, SUM(t.amount) as total
FROM transactions t
JOIN categories c ON t.categoryId = c.id
WHERE t.userId = ? AND t.type = 'expense' AND t.isDeleted = false
  AND t.transactionDate LIKE 'YYYY-MM-%'
GROUP BY t.categoryId
ORDER BY total DESC
```

### Recalc budget spent for a category
```typescript
// In db.ts: recalcBudgetSpent(categoryId)
SELECT SUM(amount) as total FROM transactions
WHERE categoryId = ? AND isDeleted = false AND type = 'expense'
  AND transactionDate >= periodStart
```

### Get latest market price (with 5-min cache)
```typescript
// In routers.ts: market.prices
SELECT * FROM price_snapshots
WHERE assetType = ? ORDER BY fetchedAt DESC LIMIT 1
-- If fetchedAt < 5 min ago: return cached
-- Else: fetch from API, INSERT new row, return
```
