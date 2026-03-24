# FinTrack AI — Product Requirements (in-repo)

| Field | Value |
|---|---|
| **PRD version** | 1.1.0 |
| **Aligned with app** | `package.json` → `fintrack-ai` **1.0.0** |
| **Last updated** | 2026-03-24 |

This document is the **in-repository** product requirements snapshot. Technical implementation details live under [`docs/ai/`](ai/) (architecture, data model, conventions, known issues).

**Official PRD outside this repo:** If your canonical PRD lives in Notion, Google Docs, Confluence, or another system, add the link here when you have it:

- **Canonical PRD URL:** _(none recorded in repo)_

---

## 1. Product summary

**FinTrack AI** is a personal finance web app for Vietnamese users: track income and spending by category, enforce budget limits with visual status, manage investments (gold, silver, savings, lending), view reports, and use an **AI chat** (Vietnamese) to record transactions or query stats and market hints.

---

## 2. Goals

- Let a signed-in user manage **categories**, **budgets**, and **transactions** in VND with clear budget health (color-coded usage).
- Provide **dashboard** overview: budgets, recent activity, investments summary, market price ticker.
- Support **investments** with asset types and optional brand-based pricing for precious metals P&L.
- Deliver **reports**: monthly spending by category, year-over-year views, budget status.
- Offer **AI-assisted** natural-language flows to record transactions (with confirmation) or query data and market-related responses, per configured prompts.

---

## 3. Out of scope / documented gaps

The following are tracked as product or UX gaps; see [`docs/ai/known-issues.md`](ai/known-issues.md) for detail and fixes:

- Market gold/silver spot pipeline may show incorrect/zero values until API/source is stabilized.
- **Settings → Tra cứu:** search is a placeholder (toast only); not a full in-app search product.
- Other open issues (e.g. cache invalidation edge cases) are listed in known-issues.

---

## 4. Functional requirements — by page

Routes follow [`client/src/App.tsx`](../client/src/App.tsx). See [`docs/ai/architecture.md`](ai/architecture.md) for tRPC procedures and data rules.

### 4.1 `/` — Dashboard

| Area | Behavior |
|---|---|
| **Context** | Shows **current calendar month/year** in the header; greets user by **first token of display name** (fallback “bạn”). |
| **AI entry** | Button links to **`/ai-chat`**. |
| **Budget strip** | If any **expense** category has a budget and **pctUsed ≥ 100%**: red alert listing count, up to two category names with spent/cap, link to **`/categories`**. If budgets exist and none over: green “within budget” strip. If no expense budgets: dashed CTA to set budgets on **`/categories`**. |
| **Totals row** | Three tiles: **Thu nhập**, **Chi tiêu**, **Số dư** (income − expense) for the month via `report.monthly`; amounts shown in **short form** (tr / k) with footnote. |
| **Recent transactions** | Up to **5** rows for the **current month** (`transaction.list` with month date range); each row: category icon/color, note or category name, formatted date, signed amount (expense red / income green). Empty state suggests **AI Chat**. “Tất cả” → **`/transactions`**. |
| **Investments summary** | If no investments: empty state + link to **`/investments`**. Else: **total invested**, **current value** (gold/silver valued using **brand prices** from `market.brandPrices` when available), **P&L**, and a **4-cell grid** counting items per asset type (`gold`, `silver`, `savings`, `lending`). “Chi tiết” → **`/investments`**. |

### 4.2 `/ai-chat` — FinTrack AI

| Area | Behavior |
|---|---|
| **Session** | Client generates a **session id** per page load; sent with each `ai.chat` request. |
| **Welcome** | Default assistant message explains natural-language **expense**, **income**, **reports**, and **market** examples. |
| **Suggested prompts** | Chips shown only when **no user messages yet**; sending fills the input path. |
| **Send flow** | User message appended; typing indicator; `ai.chat` returns **intent**, **assistant text**, optional **transaction draft**. |
| **RECORD intent** | Renders **TransactionConfirmCard**: amount, date label (“Hôm nay” vs ISO date), optional location, category display. If AI did not resolve `categoryId`, user **must pick** from `allCategories` before confirm. Actions: **Hủy** (marks cancelled) or **Xác nhận ghi** → `transaction.create` with `source: "ai_chat"`, invalidates transactions/categories/reports. Success updates bubble to “Đã ghi vào giao dịch”. |
| **Other intents** | Assistant reply only (no confirm card). |
| **Errors** | Failed chat shows generic apology message. |

### 4.3 `/categories` — Danh mục

| Area | Behavior |
|---|---|
| **Tabs** | Filter list: **Tất cả**, **Chi tiêu**, **Thu nhập** (counts in labels). |
| **Recalc** | On **mount**, calls `category.recalcBudgets`. **Cập nhật** button repeats recalc (spinner while pending). |
| **Seed** | **Tạo mẫu** / **Dùng mẫu** when list empty: `category.seedTemplates` (skipped toast if user already has categories). |
| **Create / edit** | Dialog: **name** (required), **type** (only on create: expense vs income), **icon** (preset grid) and **color**. **Expense:** optional **budget amount** + **period** (daily / weekly / monthly / yearly). **Income:** optional **target amount** + period (monthly vs yearly in UI copy). Edit can **clear** budget by emptying amount if a budget existed. |
| **Cards** | Show icon, name, type badge. **Expense + budget:** spent, cap, % badge, progress bar, remaining or overage messaging, color status. **Expense, no budget:** hint text. **Income:** optional target line + **“Đã tích lũy tháng này”** from `monthlyIncome`. |
| **Actions** | **Edit** and **Delete** (confirm) per card; delete is soft-delete on server. |

### 4.4 `/transactions` — Giao dịch

| Area | Behavior |
|---|---|
| **Scope** | List and summaries default to **current month** (start/end date strings for that month). |
| **Summary** | Three cards: **Thu nhập**, **Chi tiêu**, **Còn lại** from `report.monthly`. |
| **Filters** | **Search** across note, category name, location (client-side on loaded list). **Type filter:** all / expense / income (server `transaction.list`). |
| **Grouping** | Transactions grouped **by `transactionDate`**, dates descending; per-day subtotals for income and expense. |
| **Row** | Category icon, note or category name, **Bot** icon if `source === "ai_chat"`, category label, optional **location**, amount; **Edit** and **Delete** (confirm). |
| **Create** | Dialog: toggle **Chi tiêu / Thu nhập**, **amount** (VNĐ, formatted), **category** (filtered by type), **note**, **location** (expense only), **date** (native date input). Submit → `transaction.create` with `source: "manual_ui"`; invalidates transactions, reports, runs `recalcBudgets`. |
| **Edit** | Dialog: same fields as create; submit → `transaction.update`. |
| **Delete** | Soft-delete via `transaction.delete`; invalidates transactions and reports and recalculates budgets. |

### 4.5 `/investments` — Đầu tư

| Area | Behavior |
|---|---|
| **Asset types** | **Gold, silver, savings, lending** with distinct fields (e.g. quantity/unit/brand for metals; rates/terms for savings/lending). Brand lists for gold (e.g. SJC, PNJ, …) and silver (Phú Quý, Ancarat, …). |
| **CRUD** | Create/edit/delete investments and **investment transactions** via drawer/UI patterns in page; totals and P&L integrate **brand prices** and `market` procedures where applicable. |
| **Savings calculator** | Embedded widget: principal, annual rate %, term value + unit (week/month/year); results from `market.calcSavings`. |
| **Market / prices** | UI to view/update **brand prices** and related market data used for valuation (see architecture for TTL and tables). |

### 4.6 `/reports` — Báo cáo

| Area | Behavior |
|---|---|
| **Period** | Header **month** and **year** selectors (year limited to current and two prior years in UI). |
| **Tab: Tháng này** | Cards: **Thu nhập**, **Chi tiêu**, **Tiết kiệm** (same as balance). **Pie chart** of expense by category; **category breakdown** list with bars and % of total expense. Empty state if no spending. |
| **Tab: So sánh năm** | Compares **selected month** spending **this year vs last year** per category (`report.yoy`): summary totals, difference and %, grouped **bar chart** (requires data). |
| **Tab: Ngân sách** | Lists budget rows from `report.budgetStatus`: icon, name, period, status badge (green/yellow/orange/red), spent vs cap, progress bar, %, remaining. Empty state points to **Danh mục**. |

### 4.7 `/settings` — Cài đặt

| Area | Behavior |
|---|---|
| **Tài khoản** | **Name** and **email** read-only (from session). **Đăng xuất** with confirm → `logout()`. |
| **Bảng tính** | Informational card; copy notes removal of old savings copy (placeholder). |
| **Tra cứu** | Keyword field + **Bắt đầu tra cứu**: validates non-empty input, then **toast stub** (no backend search). |

### 4.8 `/404` and unknown routes — Not Found

| Area | Behavior |
|---|---|
| **Content** | English **404** / “Page Not Found” message. |
| **Action** | **Go Home** navigates to **`/`**. |

### 4.9 Cross-cutting — Auth shell

| Area | Behavior |
|---|---|
| **Layout** | **`DashboardLayout`** wraps all routes above: auth gate, shared chrome (nav, theme), and consistent page container. |
| **Data access** | All personal data via **tRPC** `protectedProcedure` with `userId` scoping; no anonymous access to finance APIs. |

---

## 5. Non-functional expectations

- **Stack:** As in architecture (React, tRPC, PostgreSQL/Supabase, optional S3, OpenAI-compatible API for AI).
- **Data integrity:** Soft deletes for user-visible entities; no hard deletes in normal flows.
- **Localization:** Vietnamese UX for AI and key flows where implemented.

---

## 6. Change log (PRD document only)

| PRD version | Date | Notes |
|---|---|---|
| 1.1.0 | 2026-03-24 | Per-page functional specifications (section 4); out-of-scope updated for transaction edit and Settings search stub. |
| 1.0.0 | 2026-03-24 | Initial in-repo PRD aligned with app `1.0.0` and current feature set. |

When the product or release process changes, bump **PRD version** and **Last updated**, and add a row above.
