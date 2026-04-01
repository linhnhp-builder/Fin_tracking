import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  loadAiChatDraft,
  removeAiChatDraft,
  type AiTransactionDraft,
  type StoredAiChatDraft,
} from "@/lib/aiChatDraft";
import { todayString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, TrendingDown, TrendingUp } from "lucide-react";

function fmtNum(val: string | number | null | undefined): string {
  const raw = String(val ?? "").replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}

function parseNum(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(/,/g, "")) || 0;
}

function resolveTxDate(d: AiTransactionDraft): string {
  if (d.date === "today" || !d.date) return todayString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return d.date;
  return todayString();
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
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

type ParamsProps = { params: { msgId: string } };

export default function AIChatDraftReview({ params }: ParamsProps) {
  const msgId = decodeURIComponent(params.msgId);
  const [, setLocation] = useLocation();

  const [stored, setStored] = useState<StoredAiChatDraft | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [locationName, setLocationName] = useState("");
  const [transactionDate, setTransactionDate] = useState(todayString());

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.category.list.useQuery();

  const recalcBudgetsMutation = trpc.category.recalcBudgets.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });

  const invalidateAfterTx = () => {
    utils.transaction.list.invalidate();
    utils.category.list.invalidate();
    utils.report.monthly.invalidate();
    utils.report.yoy.invalidate();
    utils.report.budgetStatus.invalidate();
    recalcBudgetsMutation.mutate();
  };

  const createMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      invalidateAfterTx();
      removeAiChatDraft(msgId);
      toast.success("Đã lưu giao dịch");
      setLocation(`/ai-chat?ai_saved=${encodeURIComponent(msgId)}`, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const data = loadAiChatDraft(msgId);
    if (!data?.draft) {
      toast.error("Không tìm thấy bản nháp. Quay lại AI Chat.");
      setLocation("/ai-chat", { replace: true });
      return;
    }
    setStored(data);
    const d = data.draft;
    setType(d.type);
    setAmount(fmtNum(d.amount));
    setNote(d.note ?? "");
    setLocationName(d.location_name ?? "");
    setTransactionDate(resolveTxDate(d));
    if (d.categoryId) setCategoryId(String(d.categoryId));
    else setCategoryId("");
  }, [msgId, setLocation]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const categoryOptions = useMemo(() => {
    const fromApi = filteredCategories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      type: c.type,
    }));
    if (fromApi.length > 0) return fromApi;
    return stored?.draft.allCategories ?? [];
  }, [filteredCategories, stored]);

  useEffect(() => {
    if (!categoryId) return;
    const ok = categoryOptions.some((c) => String(c.id) === categoryId);
    if (!ok) setCategoryId("");
  }, [type, categoryOptions, categoryId]);

  function goBackChat() {
    setLocation("/ai-chat");
  }

  /** Chỉ lệnh gọi này (và createMutation) mới ghi giao dịch vào DB. */
  function handleSave() {
    if (!stored) return;
    if (!categoryId) {
      toast.error("Vui lòng chọn danh mục");
      return;
    }
    const amountNum = parseNum(amount);
    if (amountNum <= 0) {
      toast.error("Số tiền không hợp lệ");
      return;
    }
    createMutation.mutate({
      categoryId: parseInt(categoryId, 10),
      type,
      amount: amountNum,
      note: note || undefined,
      locationName: locationName || undefined,
      transactionDate,
      source: "ai_chat",
      aiRawInput: undefined,
    });
  }

  if (!stored) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isExpense = type === "expense";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-3 py-3 sm:px-6 md:min-h-[calc(100vh-4rem)] md:flex-none md:py-4">
      <div className="mb-4 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={goBackChat}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Quay lại AI Chat</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Chi tiết giao dịch (AI)</h1>
          <p className="text-xs text-muted-foreground">
            Chỉnh sửa nếu cần — chỉ khi nhấn &quot;Lưu giao dịch&quot; mới ghi vào cơ sở dữ liệu
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto overscroll-y-contain pb-4 max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setType("expense");
              setCategoryId("");
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
              type === "expense"
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-muted"
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            Chi tiêu
          </button>
          <button
            type="button"
            onClick={() => {
              setType("income");
              setCategoryId("");
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-all ${
              type === "income"
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-muted"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Thu nhập
          </button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Số tiền (VNĐ) *</Label>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Danh mục *</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="text-sm">
                  {c.icon ?? "💰"} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Ghi chú</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú…" />
        </div>

        {isExpense && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Địa điểm</Label>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="VD: Highlands…"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Ngày giao dịch</Label>
          <Input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} />
        </div>
      </div>

      <div className="fixed bottom-14 left-0 right-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:static md:bottom-auto md:z-auto md:border-0 md:bg-transparent md:p-0 md:pb-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            className="order-1 h-11 gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:order-2 sm:min-w-[11rem]"
            onClick={handleSave}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            Lưu giao dịch
          </Button>
          <Button
            type="button"
            variant="outline"
            className="order-2 h-11 rounded-xl sm:order-1"
            onClick={goBackChat}
          >
            Hủy
          </Button>
        </div>
      </div>
    </div>
  );
}
