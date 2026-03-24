# FinTrack AI — Coding Conventions

> **Purpose:** Naming conventions, patterns, and rules enforced throughout the codebase. Follow these when adding new features or modifying existing code.

---

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|---|---|---|
| React pages | PascalCase | `Categories.tsx`, `AIChat.tsx` |
| React components | PascalCase | `DashboardLayout.tsx`, `CategoryCard.tsx` |
| Server routers | camelCase domain prefix | `category.*`, `transaction.*`, `ai.*` |
| DB helper functions | camelCase verb+noun | `getCategoriesByUser`, `createTransaction` |
| Shared utilities | camelCase | `formatVND`, `todayString`, `getBudgetProgressColor` |
| Schema tables | camelCase (Drizzle) | `categories`, `budgetLimits`, `aiConversations` |
| Schema types | PascalCase (inferred) | `Category`, `InsertCategory`, `Transaction` |

### Variables & Functions

```typescript
// DB helpers: verb + noun + context
getCategoriesByUser(userId: number)
createTransaction(data: InsertTransaction)
softDeleteCategory(id: number, userId: number)
recalcBudgetSpent(categoryId: number)

// Router procedures: domain.action
trpc.category.list.useQuery()
trpc.transaction.create.useMutation()
trpc.ai.chat.useMutation()

// React hooks: use + noun
const { user, isAuthenticated } = useAuth()
const utils = trpc.useUtils()

// State variables: descriptive noun
const [showForm, setShowForm] = useState(false)
const [editingCategory, setEditingCategory] = useState<Category | null>(null)
const [selectedMonth, setSelectedMonth] = useState(currentMonth)
```

---

## tRPC Patterns

### Query (read data)
```typescript
// Server
category: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCategoriesByUser(ctx.user.id);
  }),
}),

// Client
const { data: categories, isLoading } = trpc.category.list.useQuery();
```

### Mutation (write data) with optimistic update
```typescript
// Server
create: protectedProcedure
  .input(z.object({ name: z.string(), type: z.enum(["income", "expense"]) }))
  .mutation(async ({ ctx, input }) => {
    return createCategory({ ...input, userId: ctx.user.id });
  }),

// Client — optimistic update pattern
const utils = trpc.useUtils();
const createMutation = trpc.category.create.useMutation({
  onMutate: async (newData) => {
    await utils.category.list.cancel();
    const prev = utils.category.list.getData();
    utils.category.list.setData(undefined, (old) => [...(old ?? []), { ...newData, id: -1 }]);
    return { prev };
  },
  onError: (_, __, ctx) => {
    utils.category.list.setData(undefined, ctx?.prev);
  },
  onSettled: () => {
    utils.category.list.invalidate();
  },
});
```

### Mutation (write data) with invalidate (for critical operations)
```typescript
const deleteMutation = trpc.transaction.delete.useMutation({
  onSuccess: () => {
    utils.transaction.list.invalidate();
    utils.category.list.invalidate();       // Refresh budget totals
    utils.report.monthly.invalidate();      // Refresh reports
    toast.success("Đã xóa giao dịch");
  },
});
```

---

## Database Patterns

### Always filter by userId (multi-tenant safety)
```typescript
// ✅ Correct
const result = await db.select().from(transactions)
  .where(and(
    eq(transactions.userId, userId),
    eq(transactions.isDeleted, false)
  ));

// ❌ Wrong — missing userId filter
const result = await db.select().from(transactions);
```

### Soft delete (never hard delete)
```typescript
// ✅ Correct
await db.update(transactions)
  .set({ isDeleted: true })
  .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

// ❌ Wrong
await db.delete(transactions).where(eq(transactions.id, id));
```

### Date fields are varchar(10) strings
```typescript
// ✅ Correct — store as YYYY-MM-DD string
const transactionDate = new Date().toISOString().split("T")[0]; // "2026-03-12"

// ❌ Wrong — Date objects cause type errors with varchar columns
const transactionDate = new Date();
```

### Decimal columns return as strings
```typescript
// ✅ Correct — always Number() before arithmetic
const amount = Number(transaction.amount);
const pctUsed = Number(budget.pctUsed);

// ❌ Wrong — string arithmetic gives NaN
const total = transaction.amount + otherAmount;
```

### After any transaction mutation, recalc budgets
```typescript
// ✅ Correct pattern in db.ts
export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  const result = await db.insert(transactions).values(data);
  if (data.type === "expense" && data.categoryId) {
    await recalcBudgetSpent(data.categoryId);  // ← Always recalc
  }
  return result;
}
```

---

## Frontend Patterns

### Money input with thousand separator
```typescript
// Use the MoneyInput helper pattern (defined inline in each page)
const [displayAmount, setDisplayAmount] = useState("");
const [amount, setAmount] = useState(0);

const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const raw = e.target.value.replace(/\./g, "").replace(/[^0-9]/g, "");
  const num = parseInt(raw) || 0;
  setAmount(num);
  setDisplayAmount(num > 0 ? new Intl.NumberFormat("vi-VN").format(num) : "");
};

<Input
  value={displayAmount}
  onChange={handleAmountChange}
  placeholder="0"
  inputMode="numeric"
/>
```

### Loading states
```typescript
// Always show skeleton/spinner while loading
if (isLoading) return <div className="animate-pulse">...</div>;
if (!data?.length) return <EmptyState message="Chưa có dữ liệu" />;
```

### Toast notifications
```typescript
import { toast } from "sonner";
toast.success("Đã lưu thành công");
toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
```

### Auth guard (already handled by DashboardLayout)
```typescript
// DashboardLayout already redirects to login if not authenticated.
// Individual pages do NOT need to check auth — just use ctx.user in procedures.
```

---

## AI Chat Patterns

### System prompt injection
```typescript
// Always inject user's categories into system prompt at runtime
const categories = await getCategoriesByUser(ctx.user.id);
const categoryList = categories.map(c => `- ${c.name} (${c.type})`).join("\n");
const systemPrompt = basePrompt.replace("{{CATEGORIES}}", categoryList);
```

### Intent handling
```typescript
// 4 intents — handle all cases
switch (parsed.intent) {
  case "RECORD":   // Save transaction → show ConfirmCard
  case "QUERY":    // Fetch DB stats → inject real data into response
  case "MARKET":   // Gold/silver prices → call market.prices
  case "UNCLEAR":  // Ask for clarification
}
```

### Category fuzzy matching (5 strategies, in order)
```typescript
// 1. Exact match (case-insensitive)
// 2. Contains match (category name contains AI suggestion)
// 3. Word overlap (shared keywords)
// 4. Note text match (AI suggestion found in transaction note)
// 5. Type-filtered fallback (first category matching income/expense type)
```

---

## CSS / Styling Conventions

### Design tokens (defined in `client/src/index.css`)
```css
/* Budget status colors */
--color-budget-green:  #10B981;   /* < 60% spent */
--color-budget-yellow: #F59E0B;   /* 60-85% spent */
--color-budget-orange: #F97316;   /* 85-100% spent */
--color-budget-red:    #EF4444;   /* > 100% spent */

/* Primary palette: black/white minimalist */
--background: oklch(1 0 0);       /* white */
--foreground: oklch(0.145 0 0);   /* near-black */
--accent: oklch(0.97 0 0);        /* light gray */
```

### Component patterns
```typescript
// Use shadcn/ui components — import from @/components/ui/*
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

// Use lucide-react for icons
import { Plus, Trash2, Edit2, RefreshCw, TrendingUp } from "lucide-react";
```

---

## Testing Conventions

All tests live in `server/*.test.ts` and use Vitest.

```typescript
// Test file naming: feature.test.ts
// server/fintrack.test.ts — main feature tests
// server/auth.logout.test.ts — auth tests

// Pattern: describe → it → expect
describe("budget color engine", () => {
  it("returns red when pctUsed >= 100", () => {
    expect(getBudgetColor(100)).toBe("red");
  });
});
```

Run tests: `pnpm test`

---

## Environment Variables

Never hardcode secrets. Use `ENV` from `server/_core/env.ts`:

```typescript
import { ENV } from "./_core/env";
ENV.forgeApiKey      // BUILT_IN_FORGE_API_KEY
ENV.forgeApiUrl      // BUILT_IN_FORGE_API_URL
ENV.ownerOpenId      // OWNER_OPEN_ID
ENV.jwtSecret        // JWT_SECRET
```

Frontend env vars use `import.meta.env.VITE_*` prefix.
