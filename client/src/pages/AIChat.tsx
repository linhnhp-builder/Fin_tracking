import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatVND, generateSessionId, todayString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Bot, User, CheckCircle, XCircle, Sparkles, MapPin, Loader2, AlertCircle } from "lucide-react";

type CategoryOption = { id: number; name: string; icon: string | null; type: string };

type TransactionDraft = {
  amount: number;
  amount_display: string;
  type: "expense" | "income";
  category_match: string;
  categoryId?: number;
  categoryName?: string;
  categoryIcon?: string;
  note: string;
  location_name: string | null;
  date: string;
  allCategories?: CategoryOption[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  intent?: string;
  transaction?: TransactionDraft | null;
  confirmed?: boolean;
};

const SUGGESTED_PROMPTS = [
  "35k cà phê ở Highlands",
  "Đi grab 50k",
  "Mua quần Uniqlo 500k",
  "Lương tháng 15 triệu",
  "Tổng chi tiêu tháng này bao nhiêu?",
  "So sánh chi tiêu tháng này với tháng trước",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function TransactionConfirmCard({
  draft,
  onConfirm,
  onReject,
  confirmed,
  isPending,
}: {
  draft: TransactionDraft;
  onConfirm: (overrideCategoryId?: number) => void;
  onReject: () => void;
  confirmed?: boolean;
  isPending?: boolean;
}) {
  const isExpense = draft.type === "expense";
  const hasCategory = !!draft.categoryId;
  const [selectedCatId, setSelectedCatId] = useState<string>(
    draft.categoryId ? String(draft.categoryId) : ""
  );

  const displayIcon = draft.categoryIcon ?? "💰";
  const displayName = draft.categoryName ?? draft.category_match;
  const displayDate = draft.date === "today" ? "Hôm nay" : draft.date;

  return (
    <div
      className={`mt-2 w-full max-w-[min(100%,22rem)] rounded-2xl border shadow-sm overflow-hidden transition-all ${
        confirmed === true
          ? "border-emerald-300/80 bg-emerald-50/60"
          : confirmed === false
          ? "border-red-200 bg-red-50/50 opacity-60"
          : "border-border/80 bg-card"
      }`}
    >
      <div className="p-4 space-y-4">
        {/* Category + note — không ép chung một hàng với số tiền */}
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted/70 text-2xl leading-none"
            aria-hidden
          >
            {displayIcon}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            <p className="text-[15px] font-semibold leading-snug text-foreground">{displayName}</p>
            {draft.note ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{draft.note}</p>
            ) : null}
          </div>
        </div>

        {/* Số tiền + ngày — khối riêng, dễ đọc trên mobile */}
        <div className="rounded-xl bg-muted/45 px-4 py-3.5 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Số tiền
            </span>
            <p
              className={`text-lg font-bold num tabular-nums tracking-tight whitespace-nowrap shrink-0 ${
                isExpense ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {isExpense ? "-" : "+"}
              {draft.amount_display} ₫
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs text-muted-foreground">
            <span>Ngày giao dịch</span>
            <span className="font-medium text-foreground num">{displayDate}</span>
          </div>
        </div>

        {/* Location */}
        {draft.location_name && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/80" />
            <span className="leading-snug">{draft.location_name}</span>
          </div>
        )}

        {/* Fallback category selector — shown when AI could not match */}
        {!hasCategory && confirmed === undefined && draft.allCategories && draft.allCategories.length > 0 && (
          <div className="space-y-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
            <div className="flex items-start gap-2 text-sm text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">AI chưa khớp danh mục. Chọn danh mục bên dưới:</span>
            </div>
            <Select value={selectedCatId} onValueChange={setSelectedCatId}>
              <SelectTrigger className="h-11 w-full text-sm bg-background">
                <SelectValue placeholder="Chọn danh mục…" />
              </SelectTrigger>
              <SelectContent>
                {draft.allCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-sm">
                    {c.icon ?? "💰"} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Actions: xếp dọc trên mobile để chữ không bị rớt dòng; ngang trên màn rộng */}
      {confirmed === undefined && (
        <div className="flex flex-col gap-2.5 border-t border-border/60 bg-muted/15 p-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-xl border-border/80 font-medium"
            onClick={onReject}
            disabled={isPending}
          >
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Hủy</span>
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            onClick={() => {
              const catId = hasCategory
                ? draft.categoryId
                : selectedCatId
                ? parseInt(selectedCatId)
                : undefined;
              onConfirm(catId);
            }}
            disabled={isPending || (!hasCategory && !selectedCatId)}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="whitespace-nowrap">Xác nhận ghi</span>
          </Button>
        </div>
      )}

      {confirmed === true && (
        <div className="flex items-center justify-center gap-2 border-t border-emerald-200/80 bg-emerald-50/40 px-4 py-3.5 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-center leading-snug">Đã ghi vào giao dịch</span>
        </div>
      )}

      {confirmed === false && (
        <div className="flex items-center justify-center gap-2 border-t border-red-200/80 bg-red-50/30 px-4 py-3.5 text-sm font-medium text-red-600">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>Đã hủy</span>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onConfirm,
  onReject,
  pendingMsgId,
}: {
  msg: Message;
  onConfirm: (msgId: string, draft: TransactionDraft, overrideCategoryId?: number) => void;
  onReject: (msgId: string) => void;
  pendingMsgId: string | null;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-foreground text-background" : "bg-muted border"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className={`max-w-[82%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser ? "bg-foreground text-background rounded-tr-sm" : "bg-muted rounded-tl-sm"
          }`}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>

        {/* Transaction confirm card */}
        {msg.intent === "RECORD" && msg.transaction && (
          <TransactionConfirmCard
            draft={msg.transaction}
            onConfirm={(overrideCatId) => onConfirm(msg.id, msg.transaction!, overrideCatId)}
            onReject={() => onReject(msg.id)}
            confirmed={msg.confirmed}
            isPending={pendingMsgId === msg.id}
          />
        )}

        <p className="text-xs text-muted-foreground px-1">
          {msg.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function AIChat() {
  const [sessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là FinTrack AI 👋\n\nBạn có thể nói với tôi:\n• Ghi chi tiêu: \"35k cà phê ở Highlands\"\n• Ghi thu nhập: \"Lương tháng 15 triệu\"\n• Hỏi báo cáo: \"Tổng chi tiêu tháng này?\"\n• Thị trường: \"Giá vàng hôm nay?\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [pendingMsgId, setPendingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const chatMutation = trpc.ai.chat.useMutation();
  const createTxMutation = trpc.transaction.create.useMutation({
    onSuccess: () => {
      utils.transaction.list.invalidate();
      utils.category.list.invalidate();
      utils.report.monthly.invalidate();
      utils.report.yoy.invalidate();
      utils.report.budgetStatus.invalidate();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function sendMessage(text: string) {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const result = await chatMutation.mutateAsync({
        message: text.trim(),
        sessionId,
      });

      const tx = result.transaction as TransactionDraft | null;

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.message,
        timestamp: new Date(),
        intent: result.intent,
        transaction: tx,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  async function handleConfirm(msgId: string, draft: TransactionDraft, overrideCategoryId?: number) {
    const catId = overrideCategoryId ?? draft.categoryId;

    if (!catId) {
      toast.error("Vui lòng chọn danh mục trước khi ghi.");
      return;
    }

    setPendingMsgId(msgId);
    try {
      await createTxMutation.mutateAsync({
        categoryId: catId,
        type: draft.type,
        amount: draft.amount,
        note: draft.note || undefined,
        locationName: draft.location_name ?? undefined,
        transactionDate: draft.date === "today" ? todayString() : draft.date,
        source: "ai_chat",
        aiRawInput: undefined,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, confirmed: true } : m))
      );
      toast.success(`✅ Đã ghi: ${draft.amount_display} ₫`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi khi ghi giao dịch";
      toast.error(msg);
    } finally {
      setPendingMsgId(null);
    }
  }

  function handleReject(msgId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmed: false } : m))
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-3 sm:px-6 py-4 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-background" />
          </div>
          <div>
            <h1 className="text-base font-semibold">FinTrack AI</h1>
            <p className="text-xs text-muted-foreground">Ghi chi tiêu bằng ngôn ngữ tự nhiên</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Sẵn sàng</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onConfirm={handleConfirm}
            onReject={handleReject}
            pendingMsgId={pendingMsgId}
          />
        ))}

        {isTyping && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-muted border flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts (only on first load) */}
      {messages.length <= 1 && (
        <div className="px-3 sm:px-6 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Thử ngay:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-t bg-background/95 backdrop-blur-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập chi tiêu... VD: 35k cà phê ở Highlands"
            className="flex-1 h-11 rounded-xl"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          AI nhận diện giao dịch → xác nhận → ghi vào mục Giao dịch
        </p>
      </div>
    </div>
  );
}
