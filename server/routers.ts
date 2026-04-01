import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createCategory,
  createInvestment,
  createInvestmentTransaction,
  createTransaction,
  getActivePrompt,
  getAiConversationHistory,
  getCategoriesByUser,
  getInvestmentTransactions,
  getInvestmentsByUser,
  getLatestGoldN8nFeed,
  getLatestSilverN8nFeed,
  getMonthlyIncomeByCategoryMap,
  getMonthlyIncomeTotals,
  getMonthlySpendingByCategory,
  getBudgetLimitsForUser,
  getTransactionsByUser,
  recalcAllBudgetsForUser,
  recalcBudgetSpent,
  saveAiConversation,
  seedDefaultPrompt,
  softDeleteCategory,
  softDeleteInvestment,
  softDeleteTransaction,
  updateCategory,
  updateInvestment,
  updateTransaction,
  upsertBudgetLimit,
  deleteBudgetLimitByCategoryId,
  upsertUser,
} from "./db";

import {
  goldVndPerLuongFromPayload,
  parseSourceTimeFromPayload,
  silverVndPerGramFromPayload,
} from "./marketN8nPayload";
import { getN8nWebhookUrlsToCall, postN8nWebhook } from "./n8nMarketRefresh";
import { ENV } from "./_core/env";

// ─── AI Chat Helper ───────────────────────────────────────────────────────────
async function callAI(messages: { role: "user" | "assistant"; content: string }[], systemPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
    }),
  });
  if (!response.ok) throw new Error(`AI API error: ${response.statusText}`);
  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}


// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Categories ──────────────────────────────────────────────────────────
  category: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const now = new Date();
      const [cats, budgets, incomeMap] = await Promise.all([
        getCategoriesByUser(ctx.user.id),
        getBudgetLimitsForUser(ctx.user.id),
        getMonthlyIncomeByCategoryMap(ctx.user.id, now.getFullYear(), now.getMonth() + 1),
      ]);
      const budgetMap = new Map(budgets.map((b) => [b.budget.categoryId, b.budget]));
      return cats.map((cat) => ({
        ...cat,
        budget: budgetMap.get(cat.id) ?? null,
        monthlyIncome: cat.type === "income" ? (incomeMap[String(cat.id)] ?? 0) : null,
      }));
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          type: z.enum(["income", "expense"]),
          icon: z.string().optional().default("💰"),
          colorHex: z.string().optional().default("#6B7280"),
          budgetAmount: z.number().positive().optional(),
          budgetPeriod: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().default("monthly"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await createCategory({
          userId: ctx.user.id,
          name: input.name,
          type: input.type,
          icon: input.icon,
          colorHex: input.colorHex,
        });
        if (input.budgetAmount && (input.type === "expense" || input.type === "income")) {
          const now = new Date();
          await upsertBudgetLimit({
            categoryId: id,
            amount: input.budgetAmount.toString(),
            period: input.budgetPeriod,
            periodStart: new Date(now.getFullYear(), now.getMonth(), 1) as unknown as string,
          });
        }
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(100).optional(),
          icon: z.string().optional(),
          colorHex: z.string().optional(),
          budgetAmount: z.number().positive().optional().nullable(),
          budgetPeriod: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, budgetAmount, budgetPeriod, ...catData } = input;
        if (Object.keys(catData).length > 0) {
          await updateCategory(id, ctx.user.id, catData);
        }
        if (budgetAmount !== undefined) {
          if (budgetAmount === null) {
            await deleteBudgetLimitByCategoryId(id);
          } else {
            const now = new Date();
            await upsertBudgetLimit({
              categoryId: id,
              amount: budgetAmount.toString(),
              period: budgetPeriod ?? "monthly",
              periodStart: new Date(now.getFullYear(), now.getMonth(), 1) as unknown as string,
            });
          }
        }
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await softDeleteCategory(input.id, ctx.user.id);
        return { success: true };
      }),

    seedTemplates: protectedProcedure.mutation(async ({ ctx }) => {
      const existing = await getCategoriesByUser(ctx.user.id);
      if (existing.length > 0) return { skipped: true };

      const templates = [
        { name: "Ăn uống", type: "expense" as const, icon: "🍜", colorHex: "#F97316", budget: 3000000 },
        { name: "Di chuyển", type: "expense" as const, icon: "🚗", colorHex: "#3B82F6", budget: 1500000 },
        { name: "Giải trí", type: "expense" as const, icon: "🎬", colorHex: "#8B5CF6", budget: 1000000 },
        { name: "Sức khỏe", type: "expense" as const, icon: "💊", colorHex: "#10B981", budget: 500000 },
        { name: "Học tập", type: "expense" as const, icon: "📚", colorHex: "#F59E0B", budget: 2000000 },
        { name: "Lương", type: "income" as const, icon: "💵", colorHex: "#10B981", budget: undefined },
      ];

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1) as unknown as string;

      for (const t of templates) {
        const id = await createCategory({
          userId: ctx.user.id,
          name: t.name,
          type: t.type,
          icon: t.icon,
          colorHex: t.colorHex,
          isTemplate: true,
        });
        if (t.budget && t.type === "expense") {
          await upsertBudgetLimit({ categoryId: id, amount: t.budget.toString(), period: "monthly", periodStart });
        }
      }
       return { seeded: true };
    }),
    recalcBudgets: protectedProcedure.mutation(async ({ ctx }) => {
      await recalcAllBudgetsForUser(ctx.user.id);
      return { success: true };
    }),
  }),
  // ─── Transactions ─────────────────────────────────────────────────────────
  transaction: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().optional().default(50),
          offset: z.number().optional().default(0),
          categoryId: z.number().optional(),
          type: z.enum(["income", "expense"]).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return getTransactionsByUser(ctx.user.id, input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          categoryId: z.number(),
          type: z.enum(["income", "expense"]),
          amount: z.number().positive(),
          note: z.string().optional(),
          locationName: z.string().optional(),
          transactionDate: z.string(),
          source: z.enum(["ai_chat", "manual_ui", "recurring"]).optional().default("manual_ui"),
          aiRawInput: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const amountDisplay = new Intl.NumberFormat("vi-VN").format(input.amount);
        const id = await createTransaction({
          userId: ctx.user.id,
          categoryId: input.categoryId,
          type: input.type,
          amount: input.amount.toString(),
          amountDisplay,
          note: input.note,
          locationName: input.locationName,
          transactionDate: input.transactionDate.slice(0, 10),
          source: input.source,
          aiRawInput: input.aiRawInput,
        });
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await softDeleteTransaction(input.id, ctx.user.id);
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          categoryId: z.number().optional(),
          type: z.enum(["income", "expense"]).optional(),
          amount: z.number().positive().optional(),
          note: z.string().optional().nullable(),
          locationName: z.string().optional().nullable(),
          transactionDate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, amount, ...rest } = input;
        const updateData: Parameters<typeof updateTransaction>[2] = { ...rest };
        if (amount !== undefined) {
          updateData.amount = amount.toString();
          updateData.amountDisplay = new Intl.NumberFormat("vi-VN").format(amount);
        }
        await updateTransaction(id, ctx.user.id, updateData);
        return { success: true };
      }),

    monthlyStats: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ ctx, input }) => {
        const [spending, totals] = await Promise.all([
          getMonthlySpendingByCategory(ctx.user.id, input.year, input.month),
          getMonthlyIncomeTotals(ctx.user.id, input.year, input.month),
        ]);
        return { spending, totals };
      }),
  }),

  // ─── Investments ──────────────────────────────────────────────────────────
  investment: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getInvestmentsByUser(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          assetType: z.enum(["gold", "silver", "savings", "lending"]),
          quantity: z.number().optional(),
          unit: z.string().optional(),
          totalInvested: z.number(),
          metadata: z.record(z.string(), z.any()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await createInvestment({
          userId: ctx.user.id,
          name: input.name,
          assetType: input.assetType,
          quantity: input.quantity?.toString(),
          unit: input.unit,
          totalInvested: input.totalInvested.toString(),
          avgCost: input.quantity && input.quantity > 0
            ? (input.totalInvested / input.quantity).toFixed(0)
            : "0",
          metadata: input.metadata,
        });
        // Record initial buy transaction
        await createInvestmentTransaction({
          investmentId: id,
          userId: ctx.user.id,
          txType: "buy",
          quantity: input.quantity?.toString(),
          amount: input.totalInvested.toString(),
          txDate: new Date() as unknown as string,
        });
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          status: z.enum(["holding", "sold", "matured"]).optional(),
          metadata: z.record(z.string(), z.any()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateInvestment(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await softDeleteInvestment(input.id, ctx.user.id);
        return { success: true };
      }),

    transactions: protectedProcedure
      .input(z.object({ investmentId: z.number() }))
      .query(async ({ input }) => {
        return getInvestmentTransactions(input.investmentId);
      }),
  }),

  // ─── Market Data ──────────────────────────────────────────────────────────
  market: router({
    prices: protectedProcedure.query(async () => {
      const [goldRow, silverRow] = await Promise.all([getLatestGoldN8nFeed(), getLatestSilverN8nFeed()]);
      const goldParsed = goldVndPerLuongFromPayload(goldRow?.payload ?? null);
      const silverParsed = silverVndPerGramFromPayload(silverRow?.payload ?? null);
      const gold = goldParsed != null && goldParsed > 0 ? goldParsed : 0;
      const silver = silverParsed != null && silverParsed > 0 ? Math.round(silverParsed) : 0;
      const goldSrc = goldRow ? parseSourceTimeFromPayload(goldRow.payload) : null;
      const silverSrc = silverRow ? parseSourceTimeFromPayload(silverRow.payload) : null;
      const goldUpdatedAt = goldRow?.ingestedAt ?? null;
      const silverUpdatedAt = silverRow?.ingestedAt ?? null;
      return {
        gold,
        silver,
        goldUpdatedAt,
        silverUpdatedAt,
        updatedAt: goldUpdatedAt ?? silverUpdatedAt ?? null,
        goldSourceLabel: goldSrc,
        silverSourceLabel: silverSrc,
        appDataVersion: "3.1.0" as const,
      };
    }),

    refreshFromN8n: protectedProcedure.mutation(async () => {
      const urls = getN8nWebhookUrlsToCall();
      if (urls.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Chưa cấu hình N8N_SJC_WEBHOOK_URL trên server (.env). Thêm URL webhook Production của workflow n8n.",
        });
      }
      for (const url of urls) {
        try {
          const { ok, status } = await postN8nWebhook(url);
          if (!ok) {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `n8n trả về HTTP ${status}. Kiểm tra workflow đang bật và URL webhook.`,
            });
          }
        } catch (e) {
          if (e instanceof TRPCError) throw e;
          const msg = e instanceof Error ? e.message : String(e);
          throw new TRPCError({
            code: "BAD_GATEWAY",
            message: `Không gọi được n8n: ${msg}`,
          });
        }
      }
      return { ok: true as const, webhooksCalled: urls.length };
    }),

    calcSavings: protectedProcedure
      .input(
        z.object({
          principal: z.number().positive(),
          ratePct: z.number().positive(),
          termValue: z.number().positive(),
          termUnit: z.enum(["week", "month", "year"]).default("month"),
        })
      )
      .query(({ input }) => {
        const { principal, ratePct, termValue, termUnit } = input;
        const rate = ratePct / 100;
        // Convert term to months for total interest calculation
        const termInMonths = termUnit === "week" ? termValue / 4.33 : termUnit === "year" ? termValue * 12 : termValue;
        // Interest per period based on selected unit
        const interestPerPeriod = termUnit === "week"
          ? Math.round((principal * rate) / 52)
          : termUnit === "year"
          ? Math.round(principal * rate)
          : Math.round((principal * rate) / 12);
        const totalInterest = Math.round(principal * rate * (termInMonths / 12));
        const maturityMs = termUnit === "week"
          ? termValue * 7 * 24 * 60 * 60 * 1000
          : termUnit === "year"
          ? termValue * 365 * 24 * 60 * 60 * 1000
          : termValue * 30 * 24 * 60 * 60 * 1000;
        return {
          interestPerPeriod,
          totalInterest,
          maturityValue: principal + totalInterest,
          maturityDate: new Date(Date.now() + maturityMs),
        };
      }),
  }),

  // ─── AI Chat ──────────────────────────────────────────────────────────────
  ai: router({
    chat: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1),
          sessionId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get user categories for context
        const cats = await getCategoriesByUser(ctx.user.id);
        const categoryNames = cats.map((c) => `${c.icon} ${c.name} (${c.type})`);

        // Build system prompt
        let systemPrompt = await getActivePrompt("main_system_prompt");
        if (!systemPrompt) {
          await seedDefaultPrompt(categoryNames);
          systemPrompt = await getActivePrompt("main_system_prompt") ?? "";
        }
        // Inject current categories
        systemPrompt = systemPrompt.replace(
          /CATEGORIES CỦA USER \(inject lúc runtime\):\n.*/,
          `CATEGORIES CỦA USER (inject lúc runtime):\n${categoryNames.join(", ")}`
        );

        // Get conversation history
        const history = await getAiConversationHistory(ctx.user.id, input.sessionId, 10);
        const messages = history
          .reverse()
          .map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));
        messages.push({ role: "user", content: input.message });

        // Call AI
        const aiResponse = await callAI(messages, systemPrompt);

        // Save conversation
        await saveAiConversation({ userId: ctx.user.id, sessionId: input.sessionId, role: "user", content: input.message });
        await saveAiConversation({ userId: ctx.user.id, sessionId: input.sessionId, role: "assistant", content: aiResponse });

        // Try to parse JSON response for RECORD intent
        let parsedData: { intent?: string; message?: string; transaction?: Record<string, unknown> | null; confidence?: number } | null = null;
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Not JSON, plain text response
        }

        // If RECORD intent, find category ID using multi-strategy fuzzy matching
        if (parsedData?.intent === "RECORD" && parsedData?.transaction) {
          const tx = parsedData.transaction as Record<string, unknown>;
          const txType = String(tx.type ?? "expense") as "expense" | "income";
          const catMatch = String(tx.category_match ?? "").toLowerCase().trim();
          const noteText = String(tx.note ?? "").toLowerCase();
          
          // Filter by transaction type first
          const typedCats = cats.filter((c) => c.type === txType);
          const allCats = cats; // fallback pool
          
          const findBestMatch = (pool: typeof cats) => {
            // Strategy 1: exact match
            let found = pool.find((c) => c.name.toLowerCase() === catMatch);
            if (found) return found;
            // Strategy 2: category name contains AI match keyword
            found = pool.find((c) => c.name.toLowerCase().includes(catMatch));
            if (found) return found;
            // Strategy 3: AI match keyword contains category name
            found = pool.find((c) => catMatch.includes(c.name.toLowerCase()));
            if (found) return found;
            // Strategy 4: match against note text
            found = pool.find((c) => noteText.includes(c.name.toLowerCase()));
            if (found) return found;
            // Strategy 5: word-level overlap
            const matchWords = catMatch.split(/\s+/);
            found = pool.find((c) => {
              const catWords = c.name.toLowerCase().split(/\s+/);
              return matchWords.some((w) => w.length > 2 && catWords.some((cw: string) => cw.includes(w) || w.includes(cw)));
            });
            return found ?? null;
          };
          
          const matchedCat = findBestMatch(typedCats) ?? findBestMatch(allCats);
          if (matchedCat) {
            tx.categoryId = matchedCat.id;
            tx.categoryName = matchedCat.name;
            tx.categoryIcon = matchedCat.icon;
          }
          // Always pass all user categories so UI can show a fallback selector
          tx.allCategories = typedCats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, type: c.type }));

          // Normalize date — AI sometimes hallucinates old dates from training data
          const txDate = String(tx.date ?? "today");
          const today = new Date().toISOString().slice(0, 10);
          if (txDate === "today" || txDate === "" || !/^\d{4}-\d{2}-\d{2}$/.test(txDate)) {
            tx.date = today;
          } else {
            const dateYear = parseInt(txDate.split("-")[0], 10);
            const currentYear = new Date().getFullYear();
            if (dateYear < currentYear - 1) tx.date = today;
          }
        }
        // If QUERY intent, fetch real DB data and build a rich response
        let queryData: Record<string, unknown> | null = null;
        if ((parsedData?.intent === "QUERY") || (!parsedData && aiResponse.toLowerCase().includes("query"))) {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth() + 1;
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear = month === 1 ? year - 1 : year;
          const [currentSpending, currentTotals, prevSpending, prevTotals, budgets] = await Promise.all([
            getMonthlySpendingByCategory(ctx.user.id, year, month),
            getMonthlyIncomeTotals(ctx.user.id, year, month),
            getMonthlySpendingByCategory(ctx.user.id, prevYear, prevMonth),
            getMonthlyIncomeTotals(ctx.user.id, prevYear, prevMonth),
            getBudgetLimitsForUser(ctx.user.id),
          ]);
          const totalExpense = currentSpending.reduce((s: number, c) => s + Number(c.total ?? 0), 0);
          const totalIncome = Number(currentTotals.income ?? 0);
          const prevTotalExpense = prevSpending.reduce((s: number, c) => s + Number(c.total ?? 0), 0);
          const prevTotalIncome = Number(prevTotals.income ?? 0);
          const budgetAlerts = budgets.filter((b) => b.budget.colorStatus === "red" || b.budget.colorStatus === "orange");
          queryData = {
            currentMonth: { year, month, totalExpense, totalIncome, net: totalIncome - totalExpense },
            prevMonth: { year: prevYear, month: prevMonth, totalExpense: prevTotalExpense, totalIncome: prevTotalIncome },
            topCategories: currentSpending.slice(0, 5),
            budgetAlerts,
          };
          // Build enriched message with real numbers
          const formatter = new Intl.NumberFormat("vi-VN");
          const diffExpense = prevTotalExpense > 0 ? (totalExpense - prevTotalExpense) / prevTotalExpense * 100 : null;
          const changeExpense = diffExpense !== null ? diffExpense.toFixed(1) : null;
          let enrichedMessage = parsedData?.message ?? aiResponse;
          enrichedMessage += `\n\n📊 **Dữ liệu thực tế tháng ${month}/${year}:**\n`;
          enrichedMessage += `• Chi tiêu: **${formatter.format(totalExpense)} ₫**`;
          if (changeExpense !== null) enrichedMessage += ` (${Number(changeExpense) >= 0 ? "+" : ""}${changeExpense}% so tháng trước)`;
          enrichedMessage += `\n• Thu nhập: **${formatter.format(totalIncome)} ₫**`;
          enrichedMessage += `\n• Còn lại: **${formatter.format(totalIncome - totalExpense)} ₫**`;
          if (currentSpending.length > 0) {
            enrichedMessage += `\n\n🏷️ **Top danh mục chi tiêu:**`;
            currentSpending.slice(0, 3).forEach((c) => {
              enrichedMessage += `\n• ${c.categoryIcon ?? ""} ${c.categoryName}: ${formatter.format(Number(c.total ?? 0))} ₫`;
            });
          }
          if (budgetAlerts.length > 0) {
            enrichedMessage += `\n\n⚠️ **Cảnh báo ngân sách:**`;
            budgetAlerts.forEach((b) => {
              enrichedMessage += `\n• ${b.category.name}: ${b.budget.colorStatus === "red" ? "Vượt ngân sách" : "Gần hết"}`;
            });
          }
          if (parsedData) parsedData.message = enrichedMessage;
          else parsedData = { intent: "QUERY", message: enrichedMessage, transaction: null };
        }
        return {
          message: parsedData?.message ?? aiResponse,
          intent: parsedData?.intent ?? "UNCLEAR",
          transaction: parsedData?.transaction ?? null,
          queryData,
          rawResponse: aiResponse,
        };
      }),

    history: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ ctx, input }) => {
        return getAiConversationHistory(ctx.user.id, input.sessionId, 50);
      }),
  }),

  // ─── Reports ──────────────────────────────────────────────────────────────
  report: router({
    monthly: protectedProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ ctx, input }) => {
        const [spending, totals] = await Promise.all([
          getMonthlySpendingByCategory(ctx.user.id, input.year, input.month),
          getMonthlyIncomeTotals(ctx.user.id, input.year, input.month),
        ]);
        return { spending, totals };
      }),

    yoy: protectedProcedure
      .input(z.object({ month: z.number() }))
      .query(async ({ ctx, input }) => {
        const currentYear = new Date().getFullYear();
        const [thisYear, lastYear] = await Promise.all([
          getMonthlySpendingByCategory(ctx.user.id, currentYear, input.month),
          getMonthlySpendingByCategory(ctx.user.id, currentYear - 1, input.month),
        ]);
        return { thisYear, lastYear, month: input.month };
      }),

    budgetStatus: protectedProcedure.query(async ({ ctx }) => {
      const budgets = await getBudgetLimitsForUser(ctx.user.id);
      return budgets.map((b) => ({
        ...b,
        pctUsed: Number(b.budget.pctUsed ?? 0),
        spent: Number(b.budget.spent ?? 0),
        amount: Number(b.budget.amount),
      }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
