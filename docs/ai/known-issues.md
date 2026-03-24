# FinTrack AI — Known Issues & Workarounds

> **Last updated:** March 2026 (v1.3). This file tracks active bugs, their root causes, and the exact fix needed. Update this file when issues are resolved.

---

## Active Issues

### ~~ISSUE-001 — AI Chat: `callAI()` uses wrong API format~~
**Severity:** 🔴 High  
**Status:** ✅ Resolved — switched to OpenAI (`gpt-4o`) with correct message format

**Fix applied in `server/routers.ts`:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Auth: `ENV.openaiApiKey` (reads `OPENAI_API_KEY` from `.env`)
- Model: `gpt-4o`
- System prompt moved to `messages[0]` with `role: "system"` (OpenAI format)

---

### ISSUE-002 — Market prices: gold/silver always show 0
**Severity:** 🔴 High — Dashboard and Investments show incorrect data  
**Status:** Open  
**File:** `server/routers.ts`, function `fetchMarketPrices()` (~line 56)

**Symptom:** Gold and silver prices display as `0 ₫` on Dashboard ticker and Investments page.

**Root cause:** The current API `https://api.metals.live/v1/spot/gold,silver` is blocked/unreachable from the sandbox environment. Returns empty or timeout.

**Tested alternatives (March 2026):**
| API | Status | Notes |
|---|---|---|
| `api.metals.live` | ❌ Blocked | Current implementation |
| `goldapi.io` | ❌ Requires paid key | |
| `sjc.com.vn` | ✅ Works | Vietnamese gold prices (SJC brand) |
| `Yahoo Finance GC=F` | ✅ Works | International gold futures |
| `Yahoo Finance SI=F` | ✅ Works | International silver futures |

**Recommended fix:**
- **Gold:** Use SJC API (`https://sjc.com.vn/GoldPrice/Index.aspx`) — returns Vietnamese domestic prices
- **Silver:** Use Yahoo Finance `SI=F` — no domestic VN silver API exists
- Add USD/VND exchange rate from `open.er-api.com` for conversion

---

### ISSUE-003 — Reports page does not refresh after transaction delete
**Severity:** 🟡 Medium — stale data displayed until page reload  
**Status:** Open  
**File:** `client/src/pages/Transactions.tsx`, `deleteMutation.onSuccess`

**Symptom:** After deleting a transaction on the Transactions page, the Reports page still shows the old spending totals until the user navigates away and back.

**Root cause:** `deleteMutation.onSuccess` invalidates `transaction.list` and `category.list` but not `report.monthly` or `report.yoy`.

**Fix:** Add report invalidation to the delete mutation:
```typescript
const deleteMutation = trpc.transaction.delete.useMutation({
  onSuccess: () => {
    utils.transaction.list.invalidate();
    utils.category.list.invalidate();
    utils.report.monthly.invalidate();   // ← Add this
    utils.report.yoy.invalidate();       // ← Add this
    utils.report.budgetStatus.invalidate(); // ← Add this
  },
});
```

---

### ISSUE-004 — No transaction edit functionality
**Severity:** 🟡 Medium — users cannot correct mistakes  
**Status:** Open  
**Files:** `client/src/pages/Transactions.tsx`, `server/routers.ts`, `server/db.ts`

**Symptom:** Transactions can only be added or soft-deleted. There is no way to edit an existing transaction's amount, category, date, or note.

**Required implementation:**
1. Add `updateTransaction(id, userId, data)` to `server/db.ts`
2. Add `transaction.update` procedure to `server/routers.ts`
3. Add `EditTransactionDialog` component to `Transactions.tsx`
4. After update, call `recalcBudgetSpent()` for both old and new `categoryId`

---

### ISSUE-005 — Silver price: no Vietnamese domestic source
**Severity:** 🟢 Low — informational limitation  
**Status:** Won't fix (no solution exists)

**Symptom:** Silver prices shown are international (Yahoo Finance SI=F converted to VNĐ), not Vietnamese domestic retail prices.

**Root cause:** No Vietnamese silver retailer (Ancarat, Phú Quý, etc.) exposes a public API. Their websites use server-side rendering with no accessible JSON endpoints.

**Workaround:** Use Yahoo Finance `SI=F` (international silver futures) with USD/VND conversion. Display a note in the UI: *"Giá bạc quốc tế quy đổi VNĐ"*.

---

### ISSUE-006 — Template file TypeScript errors (non-blocking)
**Severity:** 🟢 Low — does not affect runtime  
**Status:** Won't fix (template files)

**Symptom:** `pnpm check` reports 5 TypeScript errors in:
- `client/src/components/Markdown.tsx` (line 220) — `plugins` prop mismatch
- `client/src/pages/ComponentShowcase.tsx` (line 1392) — `height` prop mismatch

**Root cause:** These are template/showcase files from the original project scaffold. They reference internal component APIs that have changed. These files are not in any production code path and do not affect the running application.

**Action:** Do not modify these files. The errors are expected and safe to ignore.

---

### ISSUE-007 — Vite console error: `./pages/AiChat` import not found (stale)
**Severity:** 🟢 Low — stale cache artifact  
**Status:** Won't fix (clears on restart)

**Symptom:** Browser console shows: `Pre-transform error: Failed to resolve import "./pages/AiChat"`

**Root cause:** Vite's module graph cached an old import path (`AiChat` lowercase) from before a rename to `AIChat`. The actual `App.tsx` already uses the correct `import AIChat from "./pages/AIChat"`. The error is from a stale Vite cache entry.

**Action:** Ignore. Clears automatically on next Vite server restart.

---

## Resolved Issues

| Issue | Description | Fixed in |
|---|---|---|
| AI confirm card not saving | `transactionDate` was passed as full Date string instead of YYYY-MM-DD | v1.1 |
| Category exact match failing | AI returns keyword like "cà phê" but category is "Ăn uống" | v1.2 (5-strategy fuzzy match) |
| Budget spent not updating | `budget_limits` table was empty; `recalcBudgetSpent` not called on page load | v1.3 |
| Lending form had "người cho vay" | Removed per user request; replaced with period-based interest | v1.1 |
| Money inputs had no thousand separator | Added `MoneyInput` pattern with `Intl.NumberFormat("vi-VN")` | v1.1 |
