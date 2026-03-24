import { trpc } from "@/lib/trpc";
import { formatVND, formatVNDShort, formatDate, getCurrentMonthYear, ensureNumber } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Sparkles, ArrowRight, Wallet,
  PiggyBank, Bot, Plus, AlertCircle, AlertTriangle, ShieldCheck
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const { year, month } = getCurrentMonthYear();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: monthlyReport } = trpc.report.monthly.useQuery(
    { year, month },
    { refetchOnMount: "always", staleTime: 0 }
  );
  const { data: categories = [] } = trpc.category.list.useQuery();
  const { data: recentTxs = [] } = trpc.transaction.list.useQuery({ limit: 5, startDate, endDate });
  const { data: investments = [] } = trpc.investment.list.useQuery();
  const { data: brandPrices } = trpc.market.brandPrices.useQuery();

  const totalIncome = ensureNumber(monthlyReport?.totals?.income);
  const totalExpense = ensureNumber(monthlyReport?.totals?.expense);
  const balance = totalIncome - totalExpense;

  const expenseWithBudget = categories.filter(
    (c) => c.type === "expense" && c.budget && Number(c.budget.amount) > 0
  );
  const overBudgetCats = expenseWithBudget.filter((c) => Number(c.budget?.pctUsed ?? 0) >= 100);
  const overBudgetCount = overBudgetCats.length;
  const topTwoOver = overBudgetCats.slice(0, 2);
  const restOverCount = Math.max(0, overBudgetCount - 2);

  // Investment summary
  const totalInvested = investments.reduce((s, inv) => s + Number(inv.totalInvested), 0);
  const totalInvCurrentValue = investments.reduce((s, inv) => {
    let cv = Number(inv.totalInvested);
    if (inv.assetType === "gold" && inv.quantity) {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const brand = String(meta.brand ?? "");
      const price = (brandPrices as any)?.gold?.[brand];
      if (typeof price === "number" && price > 0) cv = Number(inv.quantity) * price;
    }
    if (inv.assetType === "silver" && inv.quantity) {
      const unit = String(inv.unit ?? "");
      const phuQuyKey = unit.toLowerCase().includes("kg") ? "Phú Quý 1kg" : "Phú Quý 1 lượng";
      const price = (brandPrices as any)?.silver?.[phuQuyKey];
      if (typeof price === "number" && price > 0) cv = Number(inv.quantity) * price;
    }
    return s + cv;
  }, 0);
  const invPnl = totalInvCurrentValue - totalInvested;

  const firstName = user?.name?.split(" ").pop() ?? "bạn";

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-2.5 sm:space-y-3">
      {/* Greeting + AI: gọn, ưu tiên nội dung */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            Xin chào, {firstName} 👋
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Tháng {month}/{year}
          </p>
        </div>
        <Link href="/ai-chat" className="shrink-0" aria-label="AI Chat">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 sm:h-8 sm:w-auto sm:px-2.5 sm:gap-1 rounded-full sm:rounded-md border-muted-foreground/20"
            title="AI Chat"
          >
            <Sparkles className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline text-xs">AI</span>
          </Button>
        </Link>
      </div>

      {/* 1. Cảnh báo — gọn, ít chiều cao */}
      {overBudgetCount > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200/80 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/40 px-3 py-2.5 sm:px-4 sm:py-3"
        >
          <div className="flex gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/50">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs sm:text-sm font-medium text-red-900 dark:text-red-100 leading-snug">
                {firstName}, có <span className="num tabular-nums font-semibold">{overBudgetCount}</span> danh mục vượt ngưỡng.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-red-800/90 dark:text-red-200/85">
                {topTwoOver.map((cat) => {
                  const spent = Number(cat.budget?.spent ?? 0);
                  const cap = Number(cat.budget?.amount ?? 0);
                  return (
                    <span key={cat.id} className="inline-flex items-center gap-1">
                      <span aria-hidden>{cat.icon ?? "📦"}</span>
                      <span className="font-medium">{cat.name}</span>
                      <span className="num tabular-nums opacity-90">{formatVNDShort(spent)} / {formatVNDShort(cap)}</span>
                    </span>
                  );
                })}
                {restOverCount > 0 && (
                  <span className="text-red-700/80 dark:text-red-300/70">+{restOverCount} nữa</span>
                )}
              </div>
              <Link href="/categories" className="inline-block">
                <Button variant="outline" size="sm" className="h-7 text-[11px] border-red-200 bg-white/90 dark:bg-red-950/30 dark:border-red-800">
                  Chỉnh ngân sách <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : expenseWithBudget.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/15 px-3 py-2 sm:px-4 sm:py-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex-1">
            Ngân sách trong ngưỡng.
          </p>
          <Link href="/categories">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 dark:text-emerald-300">
              Danh mục →
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 px-3 py-2 sm:px-4 sm:py-2.5 bg-muted/10">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">Chưa đặt ngân sách. Đặt tại Danh mục để nhận cảnh báo.</p>
          <Link href="/categories">
            <Button size="sm" variant="outline" className="h-7 text-[11px]">Thiết lập</Button>
          </Link>
        </div>
      )}

      {/* 2. Thu nhập / Chi tiêu / Số dư — số gọn (tr, k), đơn vị chung bên dưới */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="px-2 py-2 sm:px-3 sm:py-2.5">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600" />
              Thu nhập
            </p>
            <p className="text-sm sm:text-base font-bold text-emerald-600 num tabular-nums leading-tight">
              {formatVNDShort(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="px-2 py-2 sm:px-3 sm:py-2.5">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              Chi tiêu
            </p>
            <p className="text-sm sm:text-base font-bold text-red-500 num tabular-nums leading-tight">
              {formatVNDShort(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none">
          <CardContent className="px-2 py-2 sm:px-3 sm:py-2.5">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
              <Wallet className="h-3 w-3 text-foreground" />
              Số dư
            </p>
            <p className={`text-sm sm:text-base font-bold num tabular-nums leading-tight ${balance >= 0 ? "text-foreground" : "text-red-500"}`}>
              {formatVNDShort(balance)}
            </p>
          </CardContent>
        </Card>
      </div>
      <p className="text-[10px] text-muted-foreground/80 text-center -mt-1">Đơn vị: triệu đồng (tr), nghìn (k)</p>

      {/* 3. Giao dịch gần đây — gọn, số dạng short */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Giao dịch gần đây</h2>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-0.5 text-muted-foreground">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {recentTxs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed bg-muted/5">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Chưa có giao dịch</p>
            <Link href="/ai-chat">
              <Button size="sm" variant="outline" className="h-6 text-[11px]">Ghi AI</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentTxs.slice(0, 5).map((item) => {
              const isExpense = item.tx.type === "expense";
              const amount = ensureNumber(item.tx.amount);
              return (
                <div key={item.tx.id} className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg border border-transparent bg-muted/20 hover:bg-muted/30">
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center text-xs shrink-0"
                    style={{ backgroundColor: `${item.category.colorHex}25` }}
                  >
                    {item.category.icon ?? "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.tx.note || item.category.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(item.tx.transactionDate)}</p>
                  </div>
                  <p className={`text-xs font-semibold num tabular-nums shrink-0 ${isExpense ? "text-red-500" : "text-emerald-600"}`}>
                    {isExpense ? "−" : "+"}{formatVNDShort(amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Danh mục đầu tư — số short, gọn */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Đầu tư</h2>
          <Link href="/investments">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-0.5 text-muted-foreground">
              Chi tiết <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {investments.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed bg-muted/5">
            <PiggyBank className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Chưa có đầu tư</p>
            <Link href="/investments">
              <Button size="sm" variant="outline" className="h-6 text-[11px]">Thêm</Button>
            </Link>
          </div>
        ) : (
          <Card className="border-0 bg-muted/30 shadow-none">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tổng đầu tư</span>
                <span className="font-semibold num tabular-nums">{formatVNDShort(totalInvested)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Hiện tại</span>
                <span className="font-semibold num tabular-nums">{formatVNDShort(totalInvCurrentValue)}</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-1.5">
                <span className="text-muted-foreground">Lãi/Lỗ</span>
                <span className={`font-semibold num tabular-nums flex items-center gap-0.5 ${invPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {invPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {invPnl >= 0 ? "+" : ""}{formatVNDShort(invPnl)}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {(["gold", "silver", "savings", "lending"] as const).map((type) => {
                  const count = investments.filter((i) => i.assetType === type).length;
                  const icons: Record<string, string> = { gold: "🥇", silver: "🥈", savings: "🏦", lending: "💳" };
                  return (
                    <div key={type} className="text-center py-1 rounded-md bg-background/80 border text-[10px]">
                      <span className="text-sm">{icons[type]}</span>
                      <span className="block font-medium num">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
