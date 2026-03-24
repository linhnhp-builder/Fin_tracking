import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatVND, getBudgetProgressColor, getBudgetStatusLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmtNum(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}
function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(/,/g, "")) || 0;
}
/** Chuẩn hóa số từ API (string/number) → chuỗi hiển thị trong MoneyInput */
function formatBudgetForForm(amount: string | number | null | undefined): string {
  if (amount == null || amount === "") return "";
  const raw = String(amount).replace(/\D/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}
function MoneyInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "VD: 3.000.000"}
      value={value}
      onChange={(e) => onChange(fmtNum(e.target.value))}
      className={`num ${className ?? ""}`}
    />
  );
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Sparkles, TrendingDown, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";

const PRESET_ICONS = ["🍜","🚗","🎬","💊","📚","💵","🛍️","☕","🏠","✈️","💻","🎵","🏋️","🍕","🎮","📱","👔","💡","🎁","🐕"];
const PRESET_COLORS = ["#6B7280","#F97316","#3B82F6","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899","#06B6D4","#84CC16"];

type CategoryWithBudget = {
  id: number;
  name: string;
  type: "income" | "expense";
  icon: string | null;
  colorHex: string | null;
  isTemplate: boolean | null;
  isDeleted: boolean | null;
  sortOrder: number | null;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  monthlyIncome: number | null;
  budget: {
    id: number;
    categoryId: number;
    amount: string;
    spent: string | null;
    period: "daily" | "weekly" | "monthly" | "yearly" | null;
    colorStatus: "green" | "yellow" | "orange" | "red" | null;
    pctUsed: string | null;
    periodStart: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function BudgetProgressBar({ pctUsed, colorStatus }: { pctUsed: number; colorStatus: string }) {
  const color = getBudgetProgressColor(pctUsed);
  const pct = Math.min(pctUsed, 100);
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function CategoryCard({
  cat,
  onEdit,
  onDelete,
}: {
  cat: CategoryWithBudget;
  onEdit: (cat: CategoryWithBudget) => void;
  onDelete: (id: number) => void;
}) {
  const pctUsed = Number(cat.budget?.pctUsed ?? 0);
  const colorStatus = cat.budget?.colorStatus ?? "green";
  const spent = Number(cat.budget?.spent ?? 0);
  const amount = Number(cat.budget?.amount ?? 0);

  const statusColors: Record<string, string> = {
    green: "text-emerald-600 bg-emerald-50 border-emerald-200",
    yellow: "text-amber-600 bg-amber-50 border-amber-200",
    orange: "text-orange-600 bg-orange-50 border-orange-200",
    red: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <Card className={`group relative overflow-hidden transition-all hover:shadow-sm ${cat.budget && pctUsed >= 100 ? "border-red-200" : ""}`}>
      <CardContent className="px-3 py-2.5 sm:px-3 sm:py-3">
        <div className="flex items-start justify-between gap-2">
          {/* Icon + Name */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0"
              style={{ backgroundColor: `${cat.colorHex}20` }}
            >
              {cat.icon ?? "💰"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{cat.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                  {cat.type === "expense" ? (
                    <><TrendingDown className="h-2.5 w-2.5 mr-0.5 text-red-500" />Chi tiêu</>
                  ) : (
                    <><TrendingUp className="h-2.5 w-2.5 mr-0.5 text-emerald-500" />Thu nhập</>
                  )}
                </Badge>
              </div>
            </div>
          </div>

          {/* Actions — luôn hiện trên mobile (touch); hover trên desktop */}
          <div className="flex items-center gap-0.5 shrink-0 relative z-10">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(cat);
              }}
            >
              <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8 text-destructive hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(cat.id);
              }}
            >
              <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>
        </div>

        {/* Budget section */}
        {cat.budget && cat.type === "expense" && (
          <div className="mt-2 space-y-1.5">
            {/* Row 1: spent / budget + percent badge */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">
                  Đã chi: <span className="font-semibold text-foreground">{formatVND(spent)}</span>
                </span>
                <span className="text-muted-foreground">
                  Ngân sách: {formatVND(amount)}
                </span>
              </div>
              <span className={`font-semibold px-2 py-1 rounded-md text-xs border ${statusColors[colorStatus]}`}>
                {pctUsed >= 100 ? `Vượt ${Math.round(pctUsed - 100)}%` : `${Math.round(pctUsed)}%`}
              </span>
            </div>
            {/* Progress bar */}
            <BudgetProgressBar pctUsed={pctUsed} colorStatus={colorStatus} />
            {/* Row 3: remaining or warning */}
            {pctUsed < 100 ? (
              <p className="text-xs text-muted-foreground">
                Còn lại: <span className="font-medium text-foreground">{formatVND(Math.max(0, amount - spent))}</span>
              </p>
            ) : (
              <div className={`flex items-center gap-1 text-xs ${statusColors[colorStatus]} px-2 py-1 rounded-md border`}>
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{getBudgetStatusLabel(colorStatus)}</span>
              </div>
            )}
            {pctUsed >= 60 && pctUsed < 100 && (
              <div className={`flex items-center gap-1 text-xs ${statusColors[colorStatus]} px-2 py-1 rounded-md border`}>
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{getBudgetStatusLabel(colorStatus)}</span>
              </div>
            )}
          </div>
        )}

        {cat.type === "expense" && !cat.budget && (
          <p className="mt-1.5 text-xs text-muted-foreground">Chưa đặt ngân sách</p>
        )}

        {/* Income section — mục tiêu + đã tích lũy */}
        {cat.type === "income" && (
          <div className="mt-2 pt-2 border-t border-dashed space-y-1.5">
            {cat.budget && Number(cat.budget.amount) > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Mục tiêu ({cat.budget.period === "yearly" ? "năm" : "tháng"}):
                </span>
                <span className="font-semibold text-foreground">
                  {formatVND(Number(cat.budget.amount))} đ
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Đã tích lũy tháng này:</span>
              <span className={`font-semibold ${(cat.monthlyIncome ?? 0) > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                {(cat.monthlyIncome ?? 0) > 0 ? `+ ${formatVND(cat.monthlyIncome!)}` : "Chưa có"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FormData = {
  name: string;
  type: "income" | "expense";
  icon: string;
  colorHex: string;
  budgetAmount: string;
  budgetPeriod: "daily" | "weekly" | "monthly" | "yearly";
};

const defaultForm: FormData = {
  name: "",
  type: "expense",
  icon: "💰",
  colorHex: "#6B7280",
  budgetAmount: "",
  budgetPeriod: "monthly",
};

export default function Categories() {
  const [tab, setTab] = useState<"all" | "expense" | "income">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryWithBudget | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.category.list.useQuery();

  const createMutation = trpc.category.create.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      toast.success("Đã tạo danh mục");
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.category.update.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      toast.success("Đã cập nhật danh mục");
      setDialogOpen(false);
      setEditingCat(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.category.delete.useMutation({
    onSuccess: () => {
      utils.category.list.invalidate();
      toast.success("Đã xóa danh mục");
    },
    onError: (e) => toast.error(e.message),
  });

  const recalcMutation = trpc.category.recalcBudgets.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });

  // Auto-recalc budget spent amounts whenever the page loads
  useEffect(() => {
    recalcMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedMutation = trpc.category.seedTemplates.useMutation({
    onSuccess: (data) => {
      if (data.skipped) {
        toast.info("Bạn đã có danh mục rồi");
      } else {
        utils.category.list.invalidate();
        toast.success("Đã tạo 6 danh mục mẫu");
      }
    },
  });

  const filtered = categories.filter((c) => {
    if (tab === "expense") return c.type === "expense";
    if (tab === "income") return c.type === "income";
    return true;
  });

  function openCreate() {
    setEditingCat(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryWithBudget) {
    setEditingCat(cat);
    setForm({
      name: cat.name,
      type: cat.type,
      icon: cat.icon ?? "💰",
      colorHex: cat.colorHex ?? "#6B7280",
      budgetAmount: cat.budget ? formatBudgetForForm(cat.budget.amount) : "",
      budgetPeriod: (cat.budget?.period as FormData["budgetPeriod"]) ?? "monthly",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Tên danh mục không được để trống");
    const budgetAmount = form.budgetAmount ? parseNum(form.budgetAmount) : undefined;

    if (editingCat) {
      const canHaveBudget = editingCat.type === "expense" || editingCat.type === "income";
      const hadBudget = !!editingCat.budget;
      const trimmed = form.budgetAmount.trim();
      const updatePayload: {
        id: number;
        name: string;
        icon: string;
        colorHex: string;
        budgetAmount?: number | null;
        budgetPeriod?: FormData["budgetPeriod"];
      } = {
        id: editingCat.id,
        name: form.name,
        icon: form.icon,
        colorHex: form.colorHex,
      };
      if (canHaveBudget) {
        if (!trimmed && hadBudget) {
          updatePayload.budgetAmount = null;
        } else if (trimmed && budgetAmount && budgetAmount > 0) {
          updatePayload.budgetAmount = budgetAmount;
          updatePayload.budgetPeriod = form.budgetPeriod;
        }
      }
      updateMutation.mutate(updatePayload);
    } else {
      createMutation.mutate({
        name: form.name,
        type: form.type,
        icon: form.icon,
        colorHex: form.colorHex,
        budgetAmount,
        budgetPeriod: form.budgetPeriod,
      });
    }
  }

  const expenseCount = categories.filter((c) => c.type === "expense").length;
  const incomeCount = categories.filter((c) => c.type === "income").length;
  const overBudgetCount = categories.filter((c) => Number(c.budget?.pctUsed ?? 0) >= 100).length;

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-3 sm:space-y-4">
      {/* Header + tab filter (tab phải, cùng trục với tiêu đề, phía trên lưới card / %) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Danh mục</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {categories.length} danh mục · {expenseCount} chi tiêu · {incomeCount} thu nhập
              {overBudgetCount > 0 && (
                <span className="text-red-500 ml-2">· {overBudgetCount} vượt ngân sách</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Chi tiêu: đặt ngân sách và cảnh báo mức chi từng hạng mục. Thu nhập: gắn nguồn thu (Lương, Tiền dạy học…) và tùy chọn mục tiêu theo nguồn.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full sm:w-auto">
              <TabsList className="h-auto w-full sm:w-fit flex-wrap justify-end gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                <TabsTrigger
                  value="all"
                  className="text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
                >
                  Tất cả ({categories.length})
                </TabsTrigger>
                <TabsTrigger
                  value="expense"
                  className="text-xs rounded-lg px-3 py-1.5 text-rose-700/90 data-[state=active]:bg-rose-100 data-[state=active]:text-rose-900 data-[state=active]:shadow-sm data-[state=inactive]:bg-rose-50/60 data-[state=inactive]:text-rose-800/80"
                >
                  Chi tiêu ({expenseCount})
                </TabsTrigger>
                <TabsTrigger
                  value="income"
                  className="text-xs rounded-lg px-3 py-1.5 text-emerald-700/90 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm data-[state=inactive]:bg-emerald-50/60 data-[state=inactive]:text-emerald-800/80"
                >
                  Thu nhập ({incomeCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
                title="Cập nhật số liệu ngân sách"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
                Cập nhật
              </Button>
              {categories.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Tạo mẫu
                </Button>
              )}
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm danh mục
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-3xl mb-4">📂</div>
          <h3 className="font-semibold text-lg">Chưa có danh mục nào</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Tạo danh mục để bắt đầu theo dõi chi tiêu và thu nhập của bạn
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Dùng mẫu có sẵn
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo mới
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((cat) => (
            <CategoryCard
              key={cat.id}
              cat={cat as CategoryWithBudget}
              onEdit={openEdit}
              onDelete={(id) => {
                if (confirm("Xóa danh mục này?")) deleteMutation.mutate({ id });
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${form.colorHex}20` }}
              >
                {form.icon}
              </div>
              <div>
                <p className="font-medium">{form.name || "Tên danh mục"}</p>
                <p className="text-xs text-muted-foreground">
                  {form.type === "expense" ? "Chi tiêu" : "Thu nhập"}
                  {form.budgetAmount && (
                    form.type === "expense"
                      ? ` · Ngân sách: ${formatVND(parseNum(form.budgetAmount))}`
                      : ` · Mục tiêu: ${formatVND(parseNum(form.budgetAmount))}/${form.budgetPeriod === "yearly" ? "năm" : "tháng"}`
                  )}
                </p>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tên danh mục *</Label>
              <Input
                placeholder="VD: Ăn uống, Du lịch..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Type (only for new) */}
            {!editingCat && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Loại</Label>
                <p className="text-xs text-muted-foreground">
                  {form.type === "expense"
                    ? "Chi tiêu: đặt ngân sách để cảnh báo khi chi vượt mức."
                    : "Thu nhập: gắn nguồn thu (VD: Lương, Tiền dạy học) và tùy chọn mục tiêu."}
                </p>
                <Select
                  value={form.type}
                  onValueChange={(v) => {
                    const next = v as "income" | "expense";
                    setForm({
                      ...form,
                      type: next,
                      budgetPeriod: next === "income" ? "monthly" : form.budgetPeriod,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">💸 Chi tiêu</SelectItem>
                    <SelectItem value="income">💰 Thu nhập</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Icon picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setForm({ ...form, icon })}
                    className={`h-8 w-8 rounded-lg text-base flex items-center justify-center transition-all ${
                      form.icon === icon ? "bg-foreground text-background" : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Màu sắc</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setForm({ ...form, colorHex: color })}
                    className={`h-7 w-7 rounded-full transition-all ${
                      form.colorHex === color ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Budget (expense only) */}
            {form.type === "expense" && (
              <div className="space-y-3 p-3 rounded-xl border bg-muted/20">
                <Label className="text-xs font-medium">Ngân sách (tùy chọn)</Label>
                <div className="flex gap-2">
                  <MoneyInput
                    placeholder="VD: 3.000.000"
                    value={form.budgetAmount}
                    onChange={(v) => setForm({ ...form, budgetAmount: v })}
                    className="flex-1"
                  />
                  <Select
                    value={form.budgetPeriod}
                    onValueChange={(v) => setForm({ ...form, budgetPeriod: v as FormData["budgetPeriod"] })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Ngày</SelectItem>
                      <SelectItem value="weekly">Tuần</SelectItem>
                      <SelectItem value="monthly">Tháng</SelectItem>
                      <SelectItem value="yearly">Năm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Income target (thu nhập: số tiền + thời gian tích lũy) */}
            {form.type === "income" && (
              <div className="space-y-3 p-3 rounded-xl border bg-muted/20">
                <Label className="text-xs font-medium">Mục tiêu thu nhập (tùy chọn)</Label>
                <p className="text-xs text-muted-foreground">Số tiền và kỳ tích lũy để theo dõi tiến độ.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Số tiền (VNĐ)</Label>
                    <MoneyInput
                      placeholder="VD: 15.000.000"
                      value={form.budgetAmount}
                      onChange={(v) => setForm({ ...form, budgetAmount: v })}
                      className="w-full"
                    />
                  </div>
                  <div className="sm:w-36 space-y-1">
                    <Label className="text-xs text-muted-foreground">Theo kỳ</Label>
                    <Select
                      value={form.budgetPeriod}
                      onValueChange={(v) => setForm({ ...form, budgetPeriod: v as FormData["budgetPeriod"] })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Tháng</SelectItem>
                        <SelectItem value="yearly">Năm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingCat ? "Lưu thay đổi" : "Tạo danh mục"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
