import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  formatVND,
  formatVNDShort,
  formatDate,
  getCurrentMonthYear,
  ensureNumber,
  todayString,
  ASSET_TYPE_ICONS,
  ASSET_TYPE_LABELS,
} from "@/lib/utils";
import { computeInvestmentCurrentValue } from "@/lib/investmentCurrentValue";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Wallet,
  PiggyBank,
  Bot,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

function endOfMonthDate(year: number, month: number): string {
  const last = new Date(year, month, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, "0");
  const d = String(last.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const BANNER_DISMISS_KEY = "fintrack:dashboard:banner-dismissed";

type PieDatum = { name: string; value: number; color: string; id: string };

type AssetCategoryKey = "gold" | "silver" | "savings" | "realestate";

const ASSET_CATEGORY_ORDER: AssetCategoryKey[] = ["gold", "silver", "savings", "realestate"];

const ASSET_CATEGORY_COLORS: Record<AssetCategoryKey, string> = {
  gold: "#F59E0B",
  silver: "#64748B",
  savings: "#10B981",
  realestate: "#8B5CF6",
};

function AssetPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PieDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs shadow-md">
      <p className="font-medium truncate max-w-[200px]">{p.name}</p>
      <p className="num tabular-nums font-semibold">{formatVND(p.value)}</p>
    </div>
  );
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { year: currentYear, month: currentMonth } = getCurrentMonthYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(BANNER_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismissBanner = () => {
    try {
      sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setBannerDismissed(true);
  };

  const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
  const endDate = endOfMonthDate(selectedYear, selectedMonth);
  const effectiveTxEndDate = minIsoDate(endDate, todayString());

  const atCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  const goPrevMonth = () => {
    if (selectedMonth <= 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (atCurrentMonth) return;
    if (selectedMonth >= 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const { data: monthlyReport } = trpc.report.monthly.useQuery(
    { year: selectedYear, month: selectedMonth },
    { refetchOnMount: "always", staleTime: 0 }
  );
  const { data: categories = [] } = trpc.category.list.useQuery();
  const { data: monthTxsRaw = [] } = trpc.transaction.list.useQuery({
    limit: 80,
    startDate,
    endDate: effectiveTxEndDate,
  });
  const { data: investments = [] } = trpc.investment.list.useQuery();
const { data: marketPrices } = trpc.market.prices.useQuery();

  const totalIncome = ensureNumber(monthlyReport?.totals?.income);
  const totalExpense = ensureNumber(monthlyReport?.totals?.expense);
  const balance = totalIncome - totalExpense;

  const monthTxs = useMemo(() => {
    const sorted = [...monthTxsRaw].sort((a, b) => {
      const da = String((a as { tx: { transactionDate?: string } }).tx.transactionDate ?? "");
      const db = String((b as { tx: { transactionDate?: string } }).tx.transactionDate ?? "");
      return db.localeCompare(da);
    });
    return sorted.slice(0, 5);
  }, [monthTxsRaw]);

  const expenseWithBudget = categories.filter(
    (c) => c.type === "expense" && c.budget && Number(c.budget.amount) > 0
  );
  const overBudgetCats = expenseWithBudget.filter((c) => Number(c.budget?.pctUsed ?? 0) >= 100);
  const overBudgetCount = overBudgetCats.length;
  const topTwoOver = overBudgetCats.slice(0, 2);
  const restOverCount = Math.max(0, overBudgetCount - 2);

  const assetHoldings = useMemo(() => {
    return investments.filter(
      (inv) =>
        inv.assetType !== "lending" &&
        inv.status !== "sold"
    );
  }, [investments]);

  const categoryTotals = useMemo(() => {
    const sums: Record<AssetCategoryKey, number> = {
      gold: 0,
      silver: 0,
      savings: 0,
      realestate: 0,
    };
    for (const inv of assetHoldings) {
      const t = inv.assetType as string;
      if (t !== "gold" && t !== "silver" && t !== "savings" && t !== "realestate") continue;
      sums[t as AssetCategoryKey] += computeInvestmentCurrentValue(
        inv,
        marketPrices ?? undefined
      );
    }
    return sums;
  }, [assetHoldings, marketPrices]);

  const totalAssetValue =
    categoryTotals.gold +
    categoryTotals.silver +
    categoryTotals.savings +
    categoryTotals.realestate;

  const assetCategoryRows = useMemo(() => {
    return ASSET_CATEGORY_ORDER.map((key) => ({
      key,
      label: ASSET_TYPE_LABELS[key] ?? key,
      icon: ASSET_TYPE_ICONS[key] ?? "💰",
      value: categoryTotals[key],
      color: ASSET_CATEGORY_COLORS[key],
    }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals]);

  const pieData: PieDatum[] = useMemo(
    () =>
      assetCategoryRows.map((r) => ({
        id: r.key,
        name: r.label,
        value: r.value,
        color: r.color,
      })),
    [assetCategoryRows]
  );

  const firstName = user?.name?.split(" ").pop() ?? "bạn";

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">
            Xin chào, {firstName} 👋
          </h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">Tổng quan theo tháng</p>
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

      {/* Chọn tháng — điều khiển báo cáo + giao dịch hiển thị */}
      <div className="flex items-center justify-center gap-2 py-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-none"
          onClick={goPrevMonth}
          aria-label="Tháng trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-[9.5rem] text-center text-sm font-semibold tracking-tight capitalize">
          tháng {selectedMonth} {selectedYear}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full border-border bg-background shadow-none disabled:opacity-40"
          onClick={goNextMonth}
          disabled={atCurrentMonth}
          aria-label="Tháng sau"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!bannerDismissed &&
        (overBudgetCount > 0 ? (
          <div
            role="alert"
            className="relative rounded-xl border border-red-200/80 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/40 px-3 py-2.5 sm:px-4 sm:py-3 pr-10 sm:pr-11"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 z-10 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-red-100/80 hover:text-foreground dark:hover:bg-red-950/40"
              onClick={dismissBanner}
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </Button>
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
                        <span className="num tabular-nums opacity-90">
                          {formatVNDShort(spent)} / {formatVNDShort(cap)}
                        </span>
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
          <div className="relative flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/15 px-3 py-2 sm:px-4 sm:py-2.5 pr-10 sm:pr-11">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 z-10 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-emerald-100/80 hover:text-foreground dark:hover:bg-emerald-950/30"
              onClick={dismissBanner}
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </Button>
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex-1 min-w-0">
              Ngân sách trong ngưỡng.
            </p>
            <Link href="/categories" className="shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 dark:text-emerald-300">
                Danh mục →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="relative flex items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 px-3 py-2 sm:px-4 sm:py-2.5 bg-muted/10 pr-10 sm:pr-11">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 z-10 h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={dismissBanner}
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </Button>
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1 min-w-0">
              Chưa đặt ngân sách. Đặt tại Danh mục để nhận cảnh báo.
            </p>
            <Link href="/categories" className="shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                Thiết lập
              </Button>
            </Link>
          </div>
        ))}

      <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
        <Card className="border-0 bg-muted/30 shadow-none rounded-xl">
          <CardContent className="px-1.5 py-2 sm:px-2.5 sm:py-2.5">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5 sm:gap-1 text-center leading-tight">
              <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-600 shrink-0" />
              <span className="truncate">Thu nhập</span>
            </p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 num tabular-nums leading-tight text-center">
              {formatVNDShort(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-red-200/80 bg-muted/20 shadow-none rounded-xl dark:border-red-900/35">
          <CardContent className="px-1.5 py-2 sm:px-2.5 sm:py-2.5">
            <p className="text-[9px] sm:text-[10px] text-red-600/90 mb-0.5 flex items-center justify-center gap-0.5 sm:gap-1 text-center leading-tight">
              <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-red-500 shrink-0" />
              <span className="truncate">Chi tiêu</span>
            </p>
            <p className="text-xs sm:text-sm font-bold text-red-500 num tabular-nums leading-tight text-center">
              {formatVNDShort(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/30 shadow-none rounded-xl">
          <CardContent className="px-1.5 py-2 sm:px-2.5 sm:py-2.5">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-0.5 sm:gap-1 text-center leading-tight">
              <Wallet className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
              <span className="truncate">Số dư</span>
            </p>
            <p
              className={`text-xs sm:text-sm font-bold num tabular-nums leading-tight text-center ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {balance >= 0 ? "+" : ""}
              {formatVNDShort(balance)}
            </p>
          </CardContent>
        </Card>
      </div>
      <p className="text-[10px] text-muted-foreground/80 text-center -mt-1">
        Đơn vị: triệu đồng (tr), nghìn (k) · theo tháng đã chọn
      </p>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Giao dịch trong tháng
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              5 giao dịch mới nhất trong tháng đã chọn (đến hôm nay).
            </p>
          </div>
          <Link href="/transactions" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-0.5 text-muted-foreground">
              Tất cả <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {monthTxs.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed bg-muted/5">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Chưa có giao dịch trong tháng này</p>
            <Link href="/ai-chat">
              <Button size="sm" variant="outline" className="h-6 text-[11px]">
                Ghi AI
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {monthTxs.map((raw) => {
              const item = raw as {
                tx: {
                  id: number;
                  type: string;
                  amount: unknown;
                  note?: string | null;
                  transactionDate: string;
                };
                category: { name: string; icon?: string | null; colorHex?: string };
              };
              const isExpense = item.tx.type === "expense";
              const amount = ensureNumber(item.tx.amount);
              const colorHex = item.category.colorHex ?? "#94a3b8";
              return (
                <div
                  key={item.tx.id}
                  className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg border border-transparent bg-muted/20 hover:bg-muted/30"
                >
                  <div
                    className="h-7 w-7 rounded-md flex items-center justify-center text-xs shrink-0"
                    style={{ backgroundColor: `${colorHex}25` }}
                  >
                    {item.category.icon ?? "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.tx.note || item.category.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(item.tx.transactionDate)}</p>
                  </div>
                  <p
                    className={`text-xs font-semibold num tabular-nums shrink-0 ${isExpense ? "text-red-500" : "text-emerald-600"}`}
                  >
                    {isExpense ? "−" : "+"}
                    {formatVNDShort(amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Tài sản</h2>
          <Link href="/investments">
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-0.5 text-muted-foreground">
              Chi tiết <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1 leading-snug">
          Biểu đồ theo loại tài sản : Vàng, Bạc, Tiết kiệm và BDS
        </p>

        {pieData.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed bg-muted/5">
            <PiggyBank className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Chưa có tài sản (hoặc đã bán hết)</p>
            <Link href="/investments">
              <Button size="sm" variant="outline" className="h-6 text-[11px]">
                Thêm
              </Button>
            </Link>
          </div>
        ) : (
          <Card className="border border-border/80 shadow-none rounded-xl overflow-hidden">
            <CardContent className="p-3 sm:p-4 space-y-4">
              <div className="relative mx-auto w-full max-w-[280px] h-[220px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<AssetPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-2 max-w-[7rem]">
                    <p className="text-[10px] text-muted-foreground leading-tight">Tổng tài sản</p>
                    <p className="text-sm font-bold num tabular-nums text-foreground leading-tight mt-0.5">
                      {formatVND(totalAssetValue)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {pieData.length} loại
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1 border-t border-border/60">
                {assetCategoryRows.map((row) => {
                  const pct = totalAssetValue > 0 ? Math.round((row.value / totalAssetValue) * 100) : 0;
                  return (
                    <Link key={row.key} href="/investments" className="block group">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center text-sm shrink-0 text-white"
                          style={{ backgroundColor: row.color }}
                        >
                          <span aria-hidden>{row.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate group-hover:underline">{row.label}</p>
                              <p className="text-[10px] text-muted-foreground">Gộp mọi khoản cùng loại</p>
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-1">
                              <div>
                                <p className="text-xs font-bold num tabular-nums">{formatVND(row.value)}</p>
                                <p className="text-[10px] font-semibold num tabular-nums" style={{ color: row.color }}>
                                  {pct}%
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                            </div>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: row.color }}
                            />
                          </div>
                        </div>
                      </div>
                    </Link>
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
