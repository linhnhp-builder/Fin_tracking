import { createClient } from "@supabase/supabase-js";
import {
  InsertAiConversation,
  InsertBudgetLimit,
  InsertCategory,
  InsertInvestment,
  InsertInvestmentTransaction,
  InsertTransaction,
  InsertUser,
} from "../drizzle/schema";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const sb = getSupabaseAdmin();

  const values: Record<string, unknown> = { openId: user.openId };
  if (user.name !== undefined) values.name = user.name ?? null;
  if (user.email !== undefined) values.email = user.email ?? null;
  if (user.loginMethod !== undefined) values.loginMethod = user.loginMethod ?? null;
  if (user.role !== undefined) values.role = user.role;
  values.lastSignedIn = user.lastSignedIn ?? new Date().toISOString();

  const { error } = await sb.from("users").upsert(values, { onConflict: "openId" });
  if (error) throw new Error(`upsertUser: ${error.message}`);
}

export async function getUserByOpenId(openId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("users").select("*").eq("openId", openId).limit(1).maybeSingle();
  if (error) throw new Error(`getUserByOpenId: ${error.message}`);
  return data ?? undefined;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getCategoriesByUser(userId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("categories")
    .select("*")
    .eq("userId", userId)
    .eq("isDeleted", false)
    .order("sortOrder", { ascending: true })
    .order("createdAt", { ascending: true });
  if (error) throw new Error(`getCategoriesByUser: ${error.message}`);
  return data ?? [];
}

export async function createCategory(data: InsertCategory) {
  const sb = getSupabaseAdmin();
  const { data: result, error } = await sb.from("categories").insert(data).select("id").single();
  if (error) throw new Error(`createCategory: ${error.message}`);
  return result.id as number;
}

export async function updateCategory(id: number, userId: number, data: Partial<InsertCategory>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("categories").update(data).eq("id", id).eq("userId", userId);
  if (error) throw new Error(`updateCategory: ${error.message}`);
}

export async function softDeleteCategory(id: number, userId: number) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("categories").update({ isDeleted: true }).eq("id", id).eq("userId", userId);
  if (error) throw new Error(`softDeleteCategory: ${error.message}`);
}

// ─── Budget Limits ────────────────────────────────────────────────────────────
export async function getBudgetLimitByCategoryId(categoryId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("budget_limits").select("*").eq("categoryId", categoryId).limit(1).maybeSingle();
  if (error) throw new Error(`getBudgetLimitByCategoryId: ${error.message}`);
  return data ?? null;
}

export async function getBudgetLimitsForUser(userId: number) {
  const cats = await getCategoriesByUser(userId);
  if (cats.length === 0) return [];
  const catIds = cats.map((c) => c.id);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("budget_limits").select("*").in("categoryId", catIds);
  if (error) throw new Error(`getBudgetLimitsForUser: ${error.message}`);

  return (data ?? []).map((budget) => ({
    budget,
    category: cats.find((c) => c.id === budget.categoryId)!,
  }));
}

export async function upsertBudgetLimit(data: InsertBudgetLimit) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("budget_limits").upsert(
    { ...data },
    { onConflict: "categoryId" }
  );
  if (error) throw new Error(`upsertBudgetLimit: ${error.message}`);
}

export async function deleteBudgetLimitByCategoryId(categoryId: number) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("budget_limits").delete().eq("categoryId", categoryId);
  if (error) throw new Error(`deleteBudgetLimitByCategoryId: ${error.message}`);
}

export async function recalcAllBudgetsForUser(userId: number) {
  const cats = await getCategoriesByUser(userId);
  const expenseCats = cats.filter((c) => c.type === "expense");
  await Promise.all(expenseCats.map((c) => recalcBudgetSpent(c.id)));
}

export async function recalcBudgetSpent(categoryId: number) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.rpc("recalc_budget_spent", { p_category_id: categoryId });
  if (error) console.warn(`[recalcBudget] category ${categoryId}: ${error.message}`);
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function getTransactionsByUser(
  userId: number,
  opts?: { limit?: number; offset?: number; categoryId?: number; type?: "income" | "expense"; startDate?: string; endDate?: string }
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("get_transactions_for_user", {
    p_user_id: userId,
    p_limit: opts?.limit ?? 50,
    p_offset: opts?.offset ?? 0,
    p_category_id: opts?.categoryId ?? null,
    p_type: opts?.type ?? null,
    p_start_date: opts?.startDate ?? null,
    p_end_date: opts?.endDate ?? null,
  });
  if (error) throw new Error(`getTransactionsByUser: ${error.message}`);
  return (data ?? []) as Array<{ tx: Record<string, unknown>; category: Record<string, unknown> }>;
}

export async function createTransaction(data: InsertTransaction) {
  const sb = getSupabaseAdmin();
  const { data: result, error } = await sb.from("transactions").insert(data).select("id").single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  if (data.type === "expense" && data.categoryId) {
    await recalcBudgetSpent(data.categoryId);
  }
  return result.id as number;
}

export async function softDeleteTransaction(id: number, userId: number) {
  const sb = getSupabaseAdmin();
  const { data: tx, error: fetchErr } = await sb
    .from("transactions")
    .select("id, type, categoryId")
    .eq("id", id)
    .eq("userId", userId)
    .limit(1)
    .maybeSingle();
  if (fetchErr) throw new Error(`softDeleteTransaction fetch: ${fetchErr.message}`);
  if (!tx) throw new Error("Transaction not found");

  const { error } = await sb.from("transactions").update({ isDeleted: true }).eq("id", id);
  if (error) throw new Error(`softDeleteTransaction: ${error.message}`);

  if (tx.type === "expense") {
    await recalcBudgetSpent(tx.categoryId);
  }
}

export async function updateTransaction(
  id: number,
  userId: number,
  data: {
    categoryId?: number;
    type?: "income" | "expense";
    amount?: string;
    amountDisplay?: string;
    note?: string | null;
    locationName?: string | null;
    transactionDate?: string;
  }
) {
  const sb = getSupabaseAdmin();
  const { data: old, error: fetchErr } = await sb
    .from("transactions")
    .select("id, type, categoryId")
    .eq("id", id)
    .eq("userId", userId)
    .eq("isDeleted", false)
    .limit(1)
    .maybeSingle();
  if (fetchErr) throw new Error(`updateTransaction fetch: ${fetchErr.message}`);
  if (!old) throw new Error("Transaction not found");

  const { error } = await sb.from("transactions").update(data).eq("id", id).eq("userId", userId);
  if (error) throw new Error(`updateTransaction: ${error.message}`);

  if (old.type === "expense") await recalcBudgetSpent(old.categoryId);
  const newType = data.type ?? old.type;
  if (newType === "expense" && data.categoryId && data.categoryId !== old.categoryId) {
    await recalcBudgetSpent(data.categoryId);
  }
}

export async function getMonthlySpendingByCategory(userId: number, year: number, month: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("get_monthly_spending_by_category", {
    p_user_id: userId,
    p_year: year,
    p_month: month,
  });
  if (error) throw new Error(`getMonthlySpendingByCategory: ${error.message}`);
  return (data ?? []) as Array<{
    categoryId: number;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    total: string;
    count: number;
  }>;
}

/** Thu nhập theo từng category trong tháng — dùng cho card "Đã tích lũy tháng này" (mọi danh mục thu nhập). */
export async function getMonthlyIncomeByCategoryMap(userId: number, year: number, month: number): Promise<Record<string, number>> {
  const sb = getSupabaseAdmin();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await sb
    .from("transactions")
    .select("categoryId, amount")
    .eq("userId", userId)
    .eq("type", "income")
    .eq("isDeleted", false)
    .gte("transactionDate", startDate)
    .lte("transactionDate", endDate);

  if (error) throw new Error(`getMonthlyIncomeByCategoryMap: ${error.message}`);

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = String(row.categoryId);
    result[id] = (result[id] ?? 0) + Number(row.amount ?? 0);
  }
  return result;
}

/** Tổng thu nhập & chi tiêu trong tháng — lấy trực tiếp từ transactions (mọi category, kể cả thu nhập tạo sau như "tiền dạy học"). */
export async function getMonthlyIncomeTotals(userId: number, year: number, month: number) {
  const sb = getSupabaseAdmin();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await sb
    .from("transactions")
    .select("type, amount")
    .eq("userId", userId)
    .eq("isDeleted", false)
    .gte("transactionDate", startDate)
    .lte("transactionDate", endDate);

  if (error) throw new Error(`getMonthlyIncomeTotals: ${error.message}`);

  let income = 0;
  let expense = 0;
  for (const row of data ?? []) {
    const rawAmt = row.amount;
    const amt = typeof rawAmt === "number" ? rawAmt : parseFloat(String(rawAmt ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    const type = String(row.type ?? "").toLowerCase();
    if (type === "income") income += amt;
    else if (type === "expense") expense += amt;
  }
  return { income, expense };
}

// ─── Investments ──────────────────────────────────────────────────────────────
export async function getInvestmentsByUser(userId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("investments")
    .select("*")
    .eq("userId", userId)
    .eq("isDeleted", false)
    .order("createdAt", { ascending: true });
  if (error) throw new Error(`getInvestmentsByUser: ${error.message}`);
  return data ?? [];
}

export async function createInvestment(data: InsertInvestment) {
  const sb = getSupabaseAdmin();
  const { data: result, error } = await sb.from("investments").insert(data).select("id").single();
  if (error) throw new Error(`createInvestment: ${error.message}`);
  return result.id as number;
}

export async function updateInvestment(id: number, userId: number, data: Partial<InsertInvestment>) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("investments").update(data).eq("id", id).eq("userId", userId);
  if (error) throw new Error(`updateInvestment: ${error.message}`);
}

export async function softDeleteInvestment(id: number, userId: number) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("investments").update({ isDeleted: true }).eq("id", id).eq("userId", userId);
  if (error) throw new Error(`softDeleteInvestment: ${error.message}`);
}

export async function getInvestmentTransactions(investmentId: number) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("investment_transactions")
    .select("*")
    .eq("investmentId", investmentId)
    .order("txDate", { ascending: false });
  if (error) throw new Error(`getInvestmentTransactions: ${error.message}`);
  return data ?? [];
}

export async function createInvestmentTransaction(data: InsertInvestmentTransaction) {
  const sb = getSupabaseAdmin();
  const { data: result, error } = await sb.from("investment_transactions").insert(data).select("id").single();
  if (error) throw new Error(`createInvestmentTransaction: ${error.message}`);
  return result.id as number;
}

// ─── n8n market feeds (v3.1) ─────────────────────────────────────────────
export type N8nFeedRow = {
  id: number;
  payload: unknown;
  source: string | null;
  ingestedAt: string;
};

export async function getLatestGoldN8nFeed(): Promise<N8nFeedRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("gold_n8n_feed")
    .select("*")
    .order("ingestedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestGoldN8nFeed: ${error.message}`);
  return (data as N8nFeedRow) ?? null;
}

export async function getLatestSilverN8nFeed(): Promise<N8nFeedRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("silver_n8n_feed")
    .select("*")
    .order("ingestedAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestSilverN8nFeed: ${error.message}`);
  return (data as N8nFeedRow) ?? null;
}

// ─── AI Conversations ─────────────────────────────────────────────────────────
export async function getAiConversationHistory(userId: number, sessionId: string, limit = 10) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("ai_conversations")
    .select("*")
    .eq("userId", userId)
    .eq("sessionId", sessionId)
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getAiConversationHistory: ${error.message}`);
  return data ?? [];
}

export async function saveAiConversation(data: InsertAiConversation) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("ai_conversations").insert(data);
  if (error) throw new Error(`saveAiConversation: ${error.message}`);
}

// ─── AI Prompt Configs ────────────────────────────────────────────────────────
export async function getActivePrompt(promptKey: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("ai_prompt_configs")
    .select("promptBody")
    .eq("promptKey", promptKey)
    .eq("isActive", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActivePrompt: ${error.message}`);
  return data?.promptBody ?? null;
}

export async function seedDefaultPrompt(userCategories: string[]) {
  const existing = await getActivePrompt("main_system_prompt");
  if (existing) return;

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("ai_prompt_configs").insert({
    promptKey: "main_system_prompt",
    promptBody: buildDefaultSystemPrompt(userCategories),
    version: 1,
    isActive: true,
    changeNote: "Initial prompt",
    createdBy: "system",
  });
  if (error) throw new Error(`seedDefaultPrompt: ${error.message}`);
}

function buildDefaultSystemPrompt(userCategories: string[]): string {
  return `Bạn là FinTrack AI — trợ lý ghi chép tài chính nhanh cho người Việt Nam.

VAI TRÒ CỦA BẠN: Bạn KHÔNG quản lý cấu trúc. User đã tạo sẵn categories và danh mục đầu tư qua UI.
Bạn chỉ làm 3 việc:
1. RECORD — ghi nhanh giao dịch vào categories có sẵn
2. QUERY — truy vấn báo cáo (tổng chi tiêu, YoY, budget status)
3. MARKET — thông tin thị trường (giá vàng, bạc, tính lãi tiết kiệm, P&L)

CATEGORIES CỦA USER (inject lúc runtime):
${userCategories.join(", ")}

QUY TẮC CURRENCY NORMALIZATION:
- "k" = nghìn: 35k = 35,000
- "tr" hoặc "triệu" = triệu: 1.5tr = 1,500,000
- "tỷ" = tỷ: 1 tỷ = 1,000,000,000
- amount_display: luôn có dấu phẩy ngăn cách hàng nghìn, VD: "1,865,000"

QUY TẮC LOCATION EXTRACTION (cho expense):
- Extract tên địa điểm/cửa hàng từ câu chat
- VD: "35k cà phê ở Highlands" → location_name: "Highlands"
- VD: "mua quần ở Uniqlo 500k" → location_name: "Uniqlo"
- Nếu không có địa điểm → location_name: null

QUY TẮC INTENT CLASSIFICATION:
- RECORD: có số tiền + ngữ cảnh chi tiêu/thu nhập
- QUERY: hỏi tổng hợp, báo cáo, so sánh
- MARKET: hỏi giá vàng, bạc, lãi suất, P&L đầu tư
- UNCLEAR: không đủ thông tin, confidence < 0.7

QUY TẮC QUAN TRỌNG:
- KHÔNG tự tạo category mới
- KHÔNG thay đổi budget limit
- KHÔNG ghi DB trực tiếp — luôn trả về JSON để UI confirm
- Nếu không chắc category → hỏi lại 1 câu cụ thể
- Với type=income: category_match phải là tên đúng của một category thu nhập có trong danh sách (VD: "Lương", "Tiền dạy học"). Khớp theo tên category user đã tạo.

RESPONSE FORMAT cho RECORD intent:
Trả về JSON với format:
{
  "intent": "RECORD",
  "transaction": {
    "amount": <số nguyên VNĐ>,
    "amount_display": "<formatted string>",
    "type": "expense" | "income",
    "category_match": "<tên category khớp>",
    "note": "<mô tả ngắn>",
    "location_name": "<địa điểm hoặc null>",
    "date": "<YYYY-MM-DD hoặc today>"
  },
  "confidence": <0.0-1.0>,
  "message": "<tin nhắn xác nhận thân thiện>"
}

RESPONSE FORMAT cho QUERY/MARKET intent:
Trả lời bằng văn bản tự nhiên, thân thiện, ngắn gọn bằng tiếng Việt.`;
}
