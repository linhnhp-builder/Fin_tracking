# FinTrack AI — Project TODO

## Phase 2: Setup & Design System
- [x] Database schema (8 tables: categories, budget_limits, transactions, investments, investment_transactions, price_snapshots, ai_conversations, ai_prompt_configs)
- [x] Global CSS design system (black/white theme, fonts, tokens)
- [x] Google Fonts integration (Inter + Geist Mono)

## Phase 3: Layout & Navigation
- [x] DashboardLayout with sidebar navigation
- [x] App routing (Dashboard, Categories, Transactions, AI Chat, Investments, Reports)
- [x] Auth guard and login redirect

## Phase 4: Category & Budget Management
- [x] Category list page with color-coded budget cards
- [x] Create/edit category form (name, icon, color, limit, period)
- [x] Preset template selector (onboarding: 15 templates)
- [x] Color engine: green/yellow/orange/red based on pct_used
- [x] Soft delete category
- [x] Budget limit CRUD

## Phase 5: Transaction Management
- [x] Transaction list with filters (date, category, type)
- [x] Manual transaction form (amount, note, location, date, category)
- [x] Soft delete transaction
- [x] Amount display formatting (VNĐ with separators)
- [x] Budget tracker: auto-update spent after transaction

## Phase 6: AI Chat Interface
- [x] Chat UI with message bubbles
- [x] Vietnamese NLP: intent classifier (RECORD/QUERY/MARKET/UNCLEAR)
- [x] Entity extractor (amount, category, date, location)
- [x] Category matcher (fuzzy match to user's categories)
- [x] Confirm card before saving transaction
- [x] AI query: spending reports, YoY comparison
- [x] AI market: gold/silver prices, savings interest calculator
- [x] System prompt with user categories injection
- [x] ai_prompt_configs table integration

## Phase 7: Investment Portfolio
- [x] Investment list with 4 asset types (gold, silver, savings, lending)
- [x] Create/edit investment form
- [x] P&L calculator for gold/silver using market prices
- [x] Savings interest calculator (monthly/yearly)
- [x] Lending tracker with accrued interest
- [x] Portfolio summary card

## Phase 8: Dashboard
- [x] Budget summary widgets with color status
- [x] Investment summary widget
- [x] Market ticker (gold/silver prices)
- [x] Recent transactions widget
- [x] Quick stats (total income, expense, net)

## Phase 9: Reports & Analytics
- [x] Monthly spending breakdown by category (pie chart)
- [x] Year-over-year comparison (bar chart)
- [x] Budget status overview
- [x] Income vs expense summary

## Phase 10: Polish & Tests
- [x] Loading states and skeletons
- [x] Empty states with illustrations
- [x] Error handling and toast notifications
- [x] Vitest unit tests: 24 tests passing (auth, budget color, currency, P&L, savings, date, transactions)
- [x] Final checkpoint

## Known Issues / Future Improvements
- [ ] Market price API integration (currently returns mock 0 - needs real price API)
- [ ] Push notifications for budget alerts
- [ ] Export transactions to CSV/Excel
- [ ] Mobile-responsive improvements for small screens
- [ ] ComponentShowcase.tsx template-level TS errors (not in production code path)

## Bug Fixes & Improvements (Round 2)
- [x] Fix AI Chat: confirm card saves transaction to DB via trpc.transaction.create (transactionDate YYYY-MM-DD fix)
- [x] Fix AI Chat QUERY intent: inject real DB data (income, expense, top categories, budget alerts)
- [x] Fix Lending form: remove "người cho vay" field
- [x] Fix Lending form: add period selector (tuần/tháng/năm) with period-based interest calc
- [x] Add thousand-separator MoneyInput to Categories.tsx (budget amount)
- [x] Add thousand-separator MoneyInput to Transactions.tsx (amount field)
- [x] Add thousand-separator MoneyInput to Investments.tsx (all money fields)
- [x] Update SavingsCalculator to support week/month/year period units
- [x] Update calcSavings router to compute interestPerPeriod based on term unit

## Bug Fixes (Round 3)
- [x] Fix AI Chat category matching: 5-strategy fuzzy matching (exact, contains, word-overlap, note-text, type-filtered)
- [x] Fix AI Chat confirm card: show category dropdown selector when AI cannot match category
- [x] Ensure confirmed transactions always save to DB — overrideCategoryId passed from UI to createTxMutation
- [x] Pass allCategories from server to client so fallback selector always has options

## Investigation & Fixes (Round 4)
- [ ] Test multiple gold/silver price APIs in dev environment
- [ ] Document AI API fix solution (Forge API format)
- [ ] Verify AI-to-transaction DB chain (schema, prompt, insert path)
- [ ] Seed 5 sample transactions and verify Reports page

## Feature: Budget Progress in Categories (Round 5)
- [x] Show spent amount vs budget limit on each category card (Đã chi / Ngân sách / Còn lại)
- [x] Color-coded progress bar: green (<60%), yellow (60-85%), orange (85-100%), red (>100%)
- [x] Warning badge when spending exceeds threshold (>=60%)
- [x] Add recalcAllBudgetsForUser() to db.ts
- [x] Add category.recalcBudgets mutation to routers.ts
- [x] Auto-recalc budget on Categories page mount (useEffect)
- [x] Manual refresh button in Categories header
- [x] Trigger recalcBudgets after create/delete transaction in Transactions.tsx
- [x] Seed budget_limits for existing categories via SQL
- [x] Seed 6 sample transactions and verify Reports page renders correctly

## Refactor for AI (Round 6)
- [x] BƯỚC 1: Tạo docs/ai/architecture.md
- [x] BƯỚC 1: Tạo docs/ai/conventions.md
- [x] BƯỚC 1: Tạo docs/ai/data-model.md
- [x] BƯỚC 1: Tạo docs/ai/known-issues.md
- [x] BƯỚC 2: Tách shared/date/index.ts từ utils.ts
- [x] BƯỚC 2: Tách shared/currency/index.ts từ utils.ts
- [x] BƯỚC 2: Giữ nguyên exports cũ trong utils.ts (re-export)
- [x] BƯỚC 3: Tạo .cursorrules ở root project

## Supabase Migration (Round 7)
- [x] Read full Drizzle schema (drizzle/schema.ts)
- [x] Create supabase/migrations/001_init.sql (MySQL → PostgreSQL conversion)
- [x] Add RLS policies for all tables with userId
- [x] Create env-template.md at project root (platform prevents .env.example creation)
- [x] Sync to GitHub via checkpoint
