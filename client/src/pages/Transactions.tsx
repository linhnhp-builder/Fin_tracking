import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatVND, formatDate, todayString, getCurrentMonthYear, ensureNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmtNum(val: string | number | null | undefined): string {
  const raw = String(val ?? "").replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}
function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(/,/g, "")) || 0;
}
function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "VD: 35.000"}
      value={value}
      onChange={(e) => onChange(fmtNum(e.target.value))}
      className="num text-lg font-semibold"
    />
  );
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Trash2, TrendingDown, TrendingUp, MapPin, Bot, Pencil, Search, Filter } from "lucide-react";

type TxWithCategory = {
  tx: {
    id: number;
    userId: number;
    categoryId: number;
    type: "income" | "expense";
    amount: string;
    amountDisplay: string;
    note: string | null;
    locationName: string | null;
    transactionDate: string;
    source: "ai_chat" | "manual_ui" | "recurring" | null;
    aiRawInput: string | null;
    isDeleted: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  };
  category: {
    id: number;
    name: string;
    icon: string | null;
    colorHex: string | null;
    type: "income" | "expense";
  };
};

type FormData = {
  categoryId: string;
  type: "income" | "expense";
  amount: string;
  note: string;
  locationName: string;
  transactionDate: string;
};

const defaultForm: FormData = {
  categoryId: "",
  type: "expense",
  amount: "",
  note: "",
  locationName: "",
  transactionDate: todayString(),
};

function groupByDate(txs: TxWithCategory[]) {
  const groups: Record<string, TxWithCategory[]> = {};
  for (const tx of txs) {
    const date = tx.tx.transactionDate;
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

export default function Transactions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  const { year, month } = getCurrentMonthYear();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  const utils = trpc.useUtils();
  const { data: txList = [], isLoading } = trpc.transaction.list.useQuery({
    limit: 100,
    startDate,
    endDate,
    type: filterType === "all" ? undefined : filterType,
  });

  const { data: monthlyReport } = trpc.report.monthly.useQuery(
    { year, month },
    { refetchOnMount: "always", staleTime: 0 }
  );

  const { data: categories = [] } = trpc.category.list.useQuery();

  const recalcBudgetsMutation = trpc.category.recalcBudgets.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });

  const invalidateReports = () => {
    utils.report.monthly.invalidate();
    utils.report.yoy.invalidate();
    utils.report.budgetStatus.invalidate();
  };

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      invalidateReports();
      recalcBudgetsMutation.mutate();
      toast.success("Đã ghi giao dịch");
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.transaction.delete.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      invalidateReports();
      recalcBudgetsMutation.mutate();
      toast.success("Đã xóa giao dịch");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editItem, setEditItem] = useState<TxWithCategory | null>(null);
  const [editForm, setEditForm] = useState<FormData>(defaultForm);

  const editMutation = trpc.transaction.update.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.transaction.list.refetch();
      invalidateReports();
      recalcBudgetsMutation.mutate();
      toast.success("Đã cập nhật giao dịch");
      setEditItem(null);
      setEditForm(defaultForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const editFilteredCategories = categories.filter((c) => c.type === editForm.type);

  function handleEditSubmit() {
    if (!editItem) return;
    if (!editForm.categoryId) return toast.error("Vui lòng chọn danh mục");
    const amountNum = parseNum(editForm.amount);
    if (amountNum <= 0) return toast.error("Số tiền không hợp lệ");
    editMutation.mutate({
      id: editItem.tx.id,
      categoryId: parseInt(editForm.categoryId),
      type: editForm.type,
      amount: amountNum,
      note: editForm.note || null,
      locationName: editForm.locationName || null,
      transactionDate: editForm.transactionDate,
    });
  }

  const filteredTxs = useMemo(() => {
    const list = txList as TxWithCategory[];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        (t.tx.note != null && String(t.tx.note).toLowerCase().includes(q)) ||
        String(t.category.name).toLowerCase().includes(q) ||
        (t.tx.locationName != null &&
          String(t.tx.locationName).toLowerCase().includes(q))
    );
  }, [txList, search]);

  const grouped = groupByDate(filteredTxs as TxWithCategory[]);

  const totalIncome = ensureNumber(monthlyReport?.totals?.income);
  const totalExpense = ensureNumber(monthlyReport?.totals?.expense);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  function handleSubmit() {
    if (!form.categoryId) return toast.error("Vui lòng chọn danh mục");
    const amountNum = parseNum(form.amount);
    if (amountNum <= 0) return toast.error("Số tiền không hợp lệ");

    createMutation.mutate({
      categoryId: parseInt(form.categoryId),
      type: form.type,
      amount: amountNum,
      note: form.note || undefined,
      locationName: form.locationName || undefined,
      transactionDate: form.transactionDate,
      source: "manual_ui",
    });
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Giao dịch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tháng {month}/{year}
          </p>
        </div>
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            setForm(defaultForm);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm giao dịch
        </Button>
      </div>

      {/* Summary cards */}
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
            <p className="text-xs text-muted-foreground">Còn lại</p>
            <p className={`text-lg font-bold num mt-1 ${totalIncome - totalExpense >= 0 ? "text-foreground" : "text-red-500"}`}>
              {formatVND(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm giao dịch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-full sm:w-36 h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="expense">Chi tiêu</SelectItem>
            <SelectItem value="income">Thu nhập</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-3xl mb-4">📋</div>
          <h3 className="font-semibold text-lg">Chưa có giao dịch nào</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Thêm giao dịch thủ công hoặc dùng AI Chat để ghi nhanh
          </p>
          <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm giao dịch
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, txs]) => {
            const dayIncome = txs.filter((t) => t.tx.type === "income").reduce((s, t) => s + Number(t.tx.amount), 0);
            const dayExpense = txs.filter((t) => t.tx.type === "expense").reduce((s, t) => s + Number(t.tx.amount), 0);

            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">{formatDate(date)}</p>
                  <div className="flex items-center gap-3 text-xs">
                    {dayIncome > 0 && <span className="text-emerald-600">+{formatVND(dayIncome)}</span>}
                    {dayExpense > 0 && <span className="text-red-500">-{formatVND(dayExpense)}</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  {txs.map((item) => (
                    <TransactionRow
                      key={item.tx.id}
                      item={item as TxWithCategory}
                      onEdit={(it) => {
                        const form: FormData = {
                          categoryId: String(it.tx.categoryId ?? ""),
                          type: it.tx.type,
                          amount: fmtNum(it.tx.amountDisplay ?? it.tx.amount),
                          note: it.tx.note ?? "",
                          locationName: it.tx.locationName ?? "",
                          transactionDate: it.tx.transactionDate,
                        };
                        setEditForm(form);
                        setEditItem(it);
                      }}
                      onDelete={(id) => {
                        if (confirm("Xóa giao dịch này?")) deleteMutation.mutate({ id });
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa giao dịch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditForm({ ...editForm, type: "expense", categoryId: "" })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${editForm.type === "expense" ? "bg-foreground text-background border-foreground" : "bg-background text-foreground hover:bg-muted"}`}
              >
                <TrendingDown className="h-4 w-4" /> Chi tiêu
              </button>
              <button
                onClick={() => setEditForm({ ...editForm, type: "income", categoryId: "" })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${editForm.type === "income" ? "bg-foreground text-background border-foreground" : "bg-background text-foreground hover:bg-muted"}`}
              >
                <TrendingUp className="h-4 w-4" /> Thu nhập
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Số tiền (VNĐ) *</Label>
              <MoneyInput value={editForm.amount} onChange={(v) => setEditForm({ ...editForm, amount: v })} placeholder="VD: 35.000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Danh mục *</Label>
              <Select value={editForm.categoryId} onValueChange={(v) => setEditForm({ ...editForm, categoryId: v })}>
                <SelectTrigger><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
                <SelectContent>
                  {editFilteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ghi chú</Label>
              <Input placeholder="VD: Cà phê sáng..." value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </div>
            {editForm.type === "expense" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Địa điểm</Label>
                <Input placeholder="VD: Highlands, Uniqlo..." value={editForm.locationName} onChange={(e) => setEditForm({ ...editForm, locationName: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ngày</Label>
              <Input type="date" value={editForm.transactionDate} onChange={(e) => setEditForm({ ...editForm, transactionDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Hủy</Button>
            <Button onClick={handleEditSubmit} disabled={editMutation.isPending}>Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm giao dịch</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setForm({ ...form, type: "expense", categoryId: "" })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.type === "expense"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground hover:bg-muted"
                }`}
              >
                <TrendingDown className="h-4 w-4" />
                Chi tiêu
              </button>
              <button
                onClick={() => setForm({ ...form, type: "income", categoryId: "" })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.type === "income"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground hover:bg-muted"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                Thu nhập
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Số tiền (VNĐ) *</Label>
              <MoneyInput
                value={form.amount}
                onChange={(v) => setForm({ ...form, amount: v })}
                placeholder="VD: 35.000"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Danh mục *</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm({ ...form, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ghi chú</Label>
              <Input
                placeholder="VD: Cà phê sáng, Mua quần áo..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            {/* Location (expense only) */}
            {form.type === "expense" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Địa điểm</Label>
                <Input
                  placeholder="VD: Highlands, Uniqlo..."
                  value={form.locationName}
                  onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                />
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ngày</Label>
              <Input
                type="date"
                value={form.transactionDate}
                onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              Lưu giao dịch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionRow({
  item,
  onEdit,
  onDelete,
}: {
  item: TxWithCategory;
  onEdit: (item: TxWithCategory) => void;
  onDelete: (id: number) => void;
}) {
  const { tx, category } = item;
  const isExpense = tx.type === "expense";

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-foreground/20 transition-all">
      {/* Category icon */}
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center text-base shrink-0"
        style={{ backgroundColor: `${category.colorHex}20` }}
      >
        {category.icon ?? "💰"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{tx.note || category.name}</p>
          {tx.source === "ai_chat" && (
            <Bot className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{category.name}</span>
          {tx.locationName && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                {tx.locationName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold num ${isExpense ? "text-red-500" : "text-emerald-600"}`}>
          {isExpense ? "-" : "+"}{tx.amountDisplay} ₫
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(tx.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
