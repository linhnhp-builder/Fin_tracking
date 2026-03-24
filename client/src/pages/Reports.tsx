import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatVND, getCurrentMonthYear, ensureNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, TrendingDown, BarChart2, PieChart as PieChartIcon } from "lucide-react";

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
];

const CHART_COLORS = [
  "#18181b", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8",
  "#e4e4e7", "#f4f4f5", "#52525b", "#27272a", "#09090b"
];

function formatK(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-xl shadow-lg p-3 text-xs space-y-1">
      <p className="font-medium text-sm">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold num">{formatVND(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const { year: currentYear, month: currentMonth } = getCurrentMonthYear();
  const [tab, setTab] = useState<"monthly" | "yoy" | "budget">("monthly");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: monthlyData } = trpc.report.monthly.useQuery(
    { year: selectedYear, month: selectedMonth },
    { refetchOnMount: "always", staleTime: 0 }
  );

  const { data: yoyData } = trpc.report.yoy.useQuery({
    month: selectedMonth,
  });

  const { data: budgetStatus = [] } = trpc.report.budgetStatus.useQuery();

  const totalIncome = ensureNumber(monthlyData?.totals?.income);
  const totalExpense = ensureNumber(monthlyData?.totals?.expense);
  const balance = totalIncome - totalExpense;

  // Pie chart data
  const pieData = (monthlyData?.spending ?? []).map((s, i) => ({
    name: `${s.categoryIcon ?? ""} ${s.categoryName}`,
    value: Number(s.total),
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // YoY bar chart data
  const yoyChartData = (() => {
    if (!yoyData) return [];
    const allCats = new Set([
      ...yoyData.thisYear.map((s) => s.categoryName),
      ...yoyData.lastYear.map((s) => s.categoryName),
    ]);
    return Array.from(allCats).map((cat) => ({
      name: cat,
      "Năm nay": Number(yoyData.thisYear.find((s) => s.categoryName === cat)?.total ?? 0),
      "Năm trước": Number(yoyData.lastYear.find((s) => s.categoryName === cat)?.total ?? 0),
    }));
  })();

  const totalYoyThis = yoyData?.thisYear.reduce((s, x) => s + Number(x.total), 0) ?? 0;
  const totalYoyLast = yoyData?.lastYear.reduce((s, x) => s + Number(x.total), 0) ?? 0;
  const yoyDiff = totalYoyThis - totalYoyLast;
  const yoyPct = totalYoyLast > 0 ? (yoyDiff / totalYoyLast) * 100 : 0;

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Báo cáo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Phân tích chi tiêu và ngân sách</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9">
          <TabsTrigger value="monthly" className="text-xs gap-1.5">
            <PieChartIcon className="h-3.5 w-3.5" />
            Tháng này
          </TabsTrigger>
          <TabsTrigger value="yoy" className="text-xs gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" />
            So sánh năm
          </TabsTrigger>
          <TabsTrigger value="budget" className="text-xs gap-1.5">
            Ngân sách
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Monthly tab */}
      {tab === "monthly" && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Thu nhập</p>
                <p className="text-lg font-bold text-emerald-600 num mt-1">{formatVND(totalIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Chi tiêu</p>
                <p className="text-lg font-bold text-red-500 num mt-1">{formatVND(totalExpense)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Tiết kiệm</p>
                <p className={`text-lg font-bold num mt-1 ${balance >= 0 ? "text-foreground" : "text-red-500"}`}>
                  {formatVND(balance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-semibold">Chưa có dữ liệu chi tiêu</p>
              <p className="text-sm text-muted-foreground mt-1">Thêm giao dịch để xem báo cáo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Chi tiêu theo danh mục</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Category breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Chi tiết danh mục</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(monthlyData?.spending ?? []).sort((a, b) => Number(b.total) - Number(a.total)).map((s, i) => {
                      const pct = totalExpense > 0 ? (Number(s.total) / totalExpense) * 100 : 0;
                      return (
                        <div key={s.categoryId} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span>{s.categoryIcon ?? "📦"}</span>
                              <span className="font-medium">{s.categoryName}</span>
                            </span>
                            <span className="num text-muted-foreground">{formatVND(Number(s.total))}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}%</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* YoY tab */}
      {tab === "yoy" && (
        <div className="space-y-6">
          {/* YoY summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Năm nay</p>
                <p className="text-lg font-bold num mt-1">{formatVND(totalYoyThis)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Năm trước</p>
                <p className="text-lg font-bold num mt-1">{formatVND(totalYoyLast)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Chênh lệch</p>
                <div className={`flex items-center gap-1 mt-1 ${yoyDiff <= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {yoyDiff <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  <p className="text-lg font-bold num">{yoyDiff >= 0 ? "+" : ""}{formatVND(yoyDiff)}</p>
                </div>
                <p className={`text-xs mt-0.5 ${yoyDiff <= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {yoyPct >= 0 ? "+" : ""}{yoyPct.toFixed(1)}% so với năm trước
                </p>
              </CardContent>
            </Card>
          </div>

          {yoyChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-semibold">Chưa có dữ liệu để so sánh</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">So sánh chi tiêu theo danh mục — {MONTHS[selectedMonth - 1]}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yoyChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Năm nay" fill="#18181b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Năm trước" fill="#d4d4d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Budget status tab */}
      {tab === "budget" && (
        <div className="space-y-4">
          {budgetStatus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed">
              <p className="text-4xl mb-3">💰</p>
              <p className="font-semibold">Chưa có ngân sách nào</p>
              <p className="text-sm text-muted-foreground mt-1">Tạo ngân sách trong phần Danh mục</p>
            </div>
          ) : (
            <div className="space-y-3">
              {budgetStatus.map((b) => {
                const pct = b.pctUsed;
                const statusColors: Record<string, string> = {
                  green: "text-emerald-600",
                  yellow: "text-yellow-600",
                  orange: "text-orange-500",
                  red: "text-red-500",
                };
                const progressColors: Record<string, string> = {
                  green: "bg-emerald-500",
                  yellow: "bg-yellow-400",
                  orange: "bg-orange-500",
                  red: "bg-red-500",
                };
                const status = b.budget.colorStatus ?? "green";
                const statusLabels: Record<string, string> = {
                  green: "Tốt",
                  yellow: "Chú ý",
                  orange: "Cảnh báo",
                  red: "Vượt ngân sách",
                };

                return (
                  <Card key={b.budget.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{b.category?.icon ?? "📦"}</span>
                          <div>
                            <p className="font-medium text-sm">{b.category?.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.budget.period}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[status]}`}
                        >
                          {statusLabels[status] ?? status}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Đã chi: <span className="font-medium text-foreground num">{formatVND(b.spent)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Ngân sách: <span className="font-medium text-foreground num">{formatVND(b.amount)}</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColors[status] ?? "bg-emerald-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={`font-medium ${statusColors[status]}`}>{pct.toFixed(1)}%</span>
                          <span className="text-muted-foreground num">
                            Còn lại: {formatVND(Math.max(b.amount - b.spent, 0))}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
