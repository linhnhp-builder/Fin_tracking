import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { generateSessionId } from "@/lib/utils";
import {
  storeAiChatDraft,
  removeAiChatDraft,
  type AiTransactionDraft,
} from "@/lib/aiChatDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, CheckCircle, XCircle, Sparkles, MapPin, Loader2, ChevronRight } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  intent?: string;
  transaction?: AiTransactionDraft | null;
  confirmed?: boolean;
};

const SUGGESTED_PROMPTS = [
  "35k cà phê ở Highlands",
  "Đi grab 50k",
  "Mua quần Uniqlo 500k",
  "Lương tháng 15 triệu",
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

function TransactionDraftCard({
  draft,
  msgId,
  confirmed,
  onOpenDetail,
}: {
  draft: AiTransactionDraft;
  msgId: string;
  confirmed?: boolean;
  onOpenDetail: (msgId: string, draft: AiTransactionDraft) => void;
}) {
  const isExpense = draft.type === "expense";
  const displayIcon = draft.categoryIcon ?? "💰";
  const displayName = draft.categoryName ?? draft.category_match;
  const displayDate =
    draft.date === "today"
      ? "Hôm nay"
      : draft.date?.match(/^\d{4}-\d{2}-\d{2}$/)
        ? new Date(draft.date + "T12:00:00").toLocaleDateString("vi-VN")
        : draft.date;

  if (confirmed === true) {
    return (
      <div className="mt-2 w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-emerald-300/80 bg-emerald-50/60 shadow-sm transition-all">
        <div className="p-4 space-y-4">
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
          <div className="rounded-xl bg-muted/45 px-4 py-3.5 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Số tiền</span>
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
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-emerald-200/80 bg-emerald-50/40 px-4 py-3.5 text-sm font-medium text-emerald-700">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span className="text-center leading-snug">Đã ghi vào giao dịch</span>
        </div>
      </div>
    );
  }

  if (confirmed === false) {
    return (
      <div className="mt-2 w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-red-200 bg-red-50/50 opacity-60 shadow-sm transition-all">
        <div className="p-4 space-y-4">
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
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-red-200/80 bg-red-50/30 px-4 py-3.5 text-sm font-medium text-red-600">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>Đã bỏ nháp</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="mt-2 w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm transition-all hover:border-foreground/25 hover:bg-muted/20 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpenDetail(msgId, draft)}
    >
      <div className="p-4 space-y-4">
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

        <div className="rounded-xl bg-muted/45 px-4 py-3.5 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Số tiền</span>
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

        {draft.location_name && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground/80" />
            <span className="leading-snug">{draft.location_name}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs font-medium text-muted-foreground">
          <span>Chạm để mở chi tiết — lưu / sửa / xóa nháp</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/80" aria-hidden />
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  msg,
  onOpenDetail,
}: {
  msg: Message;
  onOpenDetail: (msgId: string, draft: AiTransactionDraft) => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-foreground text-background" : "bg-muted border"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div className={`max-w-[82%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-2xl text-sm ${
            isUser
              ? "bg-foreground px-3.5 py-2.5 text-background rounded-tr-sm"
              : "bg-muted px-3 py-2 leading-snug rounded-tl-sm max-md:text-[13px] max-md:leading-snug md:px-3.5 md:py-2.5"
          }`}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>

        {msg.intent === "RECORD" && msg.transaction && (
          <TransactionDraftCard
            draft={msg.transaction}
            msgId={msg.id}
            confirmed={msg.confirmed}
            onOpenDetail={onOpenDetail}
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
  const [, setLocation] = useLocation();
  const search = useSearch();

  const [sessionId] = useState(() => generateSessionId());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là FinTrack AI 👋\n\nBạn có thể nói với tôi:\n• Ghi chi tiêu: \"35k cà phê ở Highlands\"\n• Ghi thu nhập: \"Lương tháng 15 triệu\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.ai.chat.useMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const saved = params.get("ai_saved");
    const discard = params.get("ai_discard");
    if (!saved && !discard) return;

    if (saved) {
      setMessages((prev) => prev.map((m) => (m.id === saved ? { ...m, confirmed: true } : m)));
      removeAiChatDraft(saved);
    }
    if (discard) {
      setMessages((prev) => prev.map((m) => (m.id === discard ? { ...m, confirmed: false } : m)));
      removeAiChatDraft(discard);
    }
    setLocation("/ai-chat", { replace: true });
  }, [search, setLocation]);

  function openDraftDetail(msgId: string, draft: AiTransactionDraft) {
    storeAiChatDraft(msgId, { draft });
    setLocation(`/ai-chat/draft/${encodeURIComponent(msgId)}`);
  }

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

      const tx = result.transaction as AiTransactionDraft | null;

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

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col md:min-h-[calc(100vh-4rem)] md:flex-none">
      {/* Mobile: một hàng tiêu đề trong DashboardLayout — tránh trùng logo */}
      <div className="hidden shrink-0 border-b bg-background/95 px-6 py-3 backdrop-blur-sm md:block">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground">
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

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-3 py-2 md:space-y-4 md:px-6 md:py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onOpenDetail={openDraftDetail} />
        ))}

        {isTyping && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted">
              <TypingIndicator />
            </div>
          </div>
        )}

        {messages.length <= 1 && (
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground md:text-xs">Thử ngay</p>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border bg-background px-2.5 py-1 text-[11px] transition-colors hover:bg-muted md:px-3 md:py-1.5 md:text-xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-px shrink-0" />
      </div>

      {/* Luôn dính đáy vùng main (trên bottom nav) — mobile */}
      <div className="shrink-0 border-t bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur md:px-6 md:py-4">
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
            placeholder="Nhập chi tiêu"
            className="h-10 flex-1 rounded-xl md:h-11"
            disabled={isTyping}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl md:h-11 md:w-11"
            disabled={!input.trim() || isTyping}
          >
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
