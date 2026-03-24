import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatVND, ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// (no Dialog component used anymore; market prices are edited inline per tab)
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown, Calculator, Pencil, ChevronDown, ChevronUp, Eye, CalendarDays } from "lucide-react";

type Investment = {
  id: number;
  userId: number;
  name: string;
  assetType: "gold" | "silver" | "savings" | "lending";
  quantity: string | null;
  unit: string | null;
  totalInvested: string;
  avgCost: string | null;
  currentValue: string | null;
  pnl: string | null;
  pnlPct: string | null;
  status: "holding" | "sold" | "matured" | null;
  metadata: unknown;
  isDeleted: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

type TermUnit = "week" | "month" | "year";

type FormData = {
  name: string;
  assetType: "gold" | "silver" | "savings" | "lending";
  brand: string;
  purchaseDate: string;
  quantity: string;
  unitPrice: string;
  note: string;
  unit: string;
  totalInvested: string;
  ratePct: string;
  termValue: string;
  termUnit: TermUnit;
  lendingRatePct: string;
  lendingTermValue: string;
  lendingTermUnit: TermUnit;
  dueDate: string;
};

const getDefaultForm = (): FormData => ({
  name: "",
  assetType: "gold",
  brand: "SJC",
  purchaseDate: new Date().toISOString().slice(0, 10),
  quantity: "",
  unitPrice: "",
  note: "",
  unit: "",
  totalInvested: "",
  ratePct: "",
  termValue: "",
  termUnit: "month",
  lendingRatePct: "",
  lendingTermValue: "",
  lendingTermUnit: "month",
  dueDate: "",
});

const ASSET_UNITS: Record<string, string> = {
  gold: "lượng",
  silver: "gram",
  savings: "VNĐ",
  lending: "VNĐ",
};

const TERM_UNIT_LABELS: Record<TermUnit, string> = {
  week: "Tuần",
  month: "Tháng",
  year: "Năm",
};

const GOLD_BRANDS = ["SJC", "PNJ", "Doji", "Mi Hồng", "Others"] as const;
const SILVER_BRANDS = ["Phú Quý 1kg", "Phú Quý 1 lượng", "Ancarat 1kg", "Ancarat 1 lượng"] as const;
const INVESTMENT_VIEW_VERSION: "v2.0" | "v2.1" = "v2.1";

/** Strip non-digits and format with thousand separators */
function formatInputNumber(val: string): string {
  const raw = val.replace(/[^0-9]/g, "");
  if (!raw) return "";
  return parseInt(raw, 10).toLocaleString("vi-VN");
}

/** Parse formatted number string back to number */
function parseFormattedNumber(val: string): number {
  return parseFloat(val.replace(/\./g, "").replace(/,/g, "")) || 0;
}

function daysBetweenDates(from: Date, to: Date): number {
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMidnight = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(0, Math.floor((toMidnight - fromMidnight) / (1000 * 60 * 60 * 24)));
}

/** Money input that shows thousand separators */
function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder={placeholder ?? "VD: 50.000.000"}
      value={value}
      onChange={(e) => onChange(formatInputNumber(e.target.value))}
      className={`num ${className ?? ""}`}
    />
  );
}

function SavingsCalculator() {
  const [principal, setPrincipal] = useState("100.000.000");
  const [rate, setRate] = useState("6.5");
  const [termValue, setTermValue] = useState("12");
  const [termUnit, setTermUnit] = useState<TermUnit>("month");

  const principalNum = parseFormattedNumber(principal);
  const rateNum = parseFloat(rate) || 0;
  const termValueNum = parseFloat(termValue) || 1;

  const { data: calc } = trpc.market.calcSavings.useQuery(
    {
      principal: principalNum,
      ratePct: rateNum,
      termValue: termValueNum,
      termUnit,
    },
    { enabled: !!(principalNum > 0 && rateNum > 0 && termValueNum > 0) }
  );

  const periodLabel = TERM_UNIT_LABELS[termUnit];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Tính lãi tiết kiệm / cho vay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Gốc (VNĐ)</Label>
            <MoneyInput
              value={principal}
              onChange={setPrincipal}
              placeholder="100.000.000"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Lãi suất (%/năm)</Label>
            <Input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="h-8 text-xs"
              step="0.1"
              placeholder="6.5"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Số kỳ hạn</Label>
            <Input
              type="number"
              value={termValue}
              onChange={(e) => setTermValue(e.target.value)}
              className="h-8 text-xs"
              placeholder="12"
              min="1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đơn vị kỳ hạn</Label>
            <Select value={termUnit} onValueChange={(v) => setTermUnit(v as TermUnit)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Tuần</SelectItem>
                <SelectItem value="month">Tháng</SelectItem>
                <SelectItem value="year">Năm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {calc && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Lãi/{periodLabel}</p>
              <p className="text-sm font-semibold text-emerald-600 num">{formatVND(calc.interestPerPeriod)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Tổng lãi</p>
              <p className="text-sm font-semibold text-emerald-600 num">{formatVND(calc.totalInterest)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Nhận về</p>
              <p className="text-sm font-semibold num">{formatVND(calc.maturityValue)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvestmentCard({
  inv,
  brandPrices,
  marketPrices,
  onDelete,
}: {
  inv: Investment;
  brandPrices: { gold?: Record<string, number>; silver?: Record<string, number> } | null;
  marketPrices: { gold: number; silver: number } | null;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const currentValue = useMemo(() => {
    if (inv.assetType === "gold" && inv.quantity) {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const brand = String(meta.brand ?? "");
      const price = brandPrices?.gold?.[brand];
      if (price != null && price > 0) return Number(inv.quantity) * price;

      // Fallback for legacy rows (no brand prices): market.prices.gold is VNĐ/lượng
      const unit = String(inv.unit ?? "").toLowerCase();
      const qty = Number(inv.quantity);
      if (marketPrices?.gold && qty > 0) {
        if (unit.includes("ch") || unit.includes("chỉ") || unit.includes("chi")) {
          // quantity is in chỉ -> convert to lượng
          return (qty / 10) * marketPrices.gold;
        }
        // assume quantity is in lượng
        return qty * marketPrices.gold;
      }

      return Number(inv.totalInvested);
    }
    if (inv.assetType === "silver" && inv.quantity) {
      // Silver: map non-Phú Quý brands to the nearest unit (kg/lượng).
      const unit = String(inv.unit ?? "");
      const phuQuyKey = unit.toLowerCase().includes("kg") ? "Phú Quý 1kg" : "Phú Quý 1 lượng";
      const price = brandPrices?.silver?.[phuQuyKey];
      if (price != null && price > 0) return Number(inv.quantity) * price;

      // Fallback for legacy rows: market.prices.silver is VNĐ/gram
      const qty = Number(inv.quantity);
      if (marketPrices?.silver && qty > 0) {
        const u = unit.toLowerCase();
        const grams =
          u.includes("kg") ? qty * 1000 :
          u.includes("lượng") ? qty * 37.5 :
          qty; // assume gram
        return grams * marketPrices.silver;
      }

      return Number(inv.totalInvested);
    }
    // Savings / Lending: calculate accrued interest
    if (inv.assetType === "savings" || inv.assetType === "lending") {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const ratePct = Number(meta.rate_pct ?? 0);
      if (ratePct > 0) {
        const principal = Number(inv.totalInvested);
        const daysElapsed = Math.max(0, Math.floor(
          (Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ));
        const accruedInterest = Math.round(principal * (ratePct / 100) * (daysElapsed / 365));
        return principal + accruedInterest;
      }
    }
    return Number(inv.totalInvested);
  }, [inv, brandPrices]);

  const invested = Number(inv.totalInvested);
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const isProfit = pnl >= 0;
  const typeLabel: string = ASSET_TYPE_LABELS[inv.assetType] ?? inv.assetType;
  const typeIcon: string = ASSET_TYPE_ICONS[inv.assetType] ?? "💰";

  const statusColors: Record<string, string> = {
    holding: "bg-blue-50 text-blue-600 border-blue-200",
    sold: "bg-gray-50 text-gray-600 border-gray-200",
    matured: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };
  const statusLabels: Record<string, string> = {
    holding: "Đang giữ",
    sold: "Đã bán",
    matured: "Đáo hạn",
  };

  const metaEntries = inv.metadata && typeof inv.metadata === "object"
    ? Object.entries(inv.metadata as Record<string, string>)
    : [];

  const metaLabels: Record<string, string> = {
    rate_pct: "Lãi suất (%/năm)",
    term_value: "Số kỳ hạn",
    term_unit: "Đơn vị kỳ hạn",
    due_date: "Ngày đáo hạn",
  };

  return (
    <Card className="overflow-hidden hover:shadow-sm transition-all">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
              {typeIcon}
            </div>
            <div>
              <p className="font-medium text-sm">{inv.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">{typeLabel}</Badge>
                {inv.status && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColors[inv.status] ?? ""}`}>
                    {statusLabels[inv.status] ?? ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base sm:text-sm font-bold num">{formatVND(currentValue)}</p>
            <div className={`flex items-center gap-0.5 justify-end text-xs ${isProfit ? "text-emerald-600" : "text-red-500"}`}>
              {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="num">{isProfit ? "+" : ""}{formatVND(pnl)}</span>
              <span>({pnlPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Đầu tư: <span className="num font-medium text-foreground">{formatVND(invested)}</span></span>
            {inv.quantity && (
              <span>SL: <span className="font-medium text-foreground">{inv.quantity} {String(inv.unit ?? ASSET_UNITS[inv.assetType] ?? "")}</span></span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(inv.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {metaEntries.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Chi tiết
            </button>
            {expanded && (
              <div className="mt-2 space-y-1 text-xs">
                {metaEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{metaLabels[k] ?? k.replace(/_/g, " ")}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Investments() {
  const [historyTab, setHistoryTab] = useState<"gold" | "silver" | "savings" | "lending">("gold");
  const [editId, setEditId] = useState<number | null>(null);
  const editDeleteModeRef = useRef<"edit" | "delete" | null>(null);
  const pendingCreateToDeleteIdRef = useRef<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormData>(getDefaultForm());
  const [marketCardsOpen, setMarketCardsOpen] = useState<Record<"gold" | "silver", boolean>>({
    gold: false,
    silver: false,
  });
  const [marketInputsOpen, setMarketInputsOpen] = useState<Record<"gold" | "silver", boolean>>({
    gold: false,
    silver: false,
  });

  const utils = trpc.useUtils();
  const { data: investments = [], isLoading } = trpc.investment.list.useQuery();
  const { data: brandPrices } = trpc.market.brandPrices.useQuery();
  const { data: marketPrices } = trpc.market.prices.useQuery();

  const updateBrandPricesMutation = trpc.market.updateBrandPrices.useMutation({
    onSuccess: () => {
      utils.market.brandPrices.invalidate();
      toast.success("Đã cập nhật giá thị trường theo thương hiệu");
    },
    onError: (e) => toast.error(e.message),
  });

  // Draft inputs shown in Gold/Silver tabs only
  const [goldSJC, setGoldSJC] = useState("");
  const [goldPNJ, setGoldPNJ] = useState("");
  const [goldDoji, setGoldDoji] = useState("");
  const [goldMiHong, setGoldMiHong] = useState("");

  const [silverPhuQuyKg, setSilverPhuQuyKg] = useState("");
  const [silverPhuQuyLuong, setSilverPhuQuyLuong] = useState("");

  useEffect(() => {
    if (!brandPrices) return;
    const g = (brandPrices as any).gold ?? {};
    const s = (brandPrices as any).silver ?? {};

    const format2 = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : typeof v === "string" && v ? v : "";

    setGoldSJC(format2(g["SJC"]));
    setGoldPNJ(format2(g["PNJ"]));
    setGoldDoji(format2(g["Doji"]));
    setGoldMiHong(format2(g["Mi Hồng"]));

    setSilverPhuQuyKg(format2(s["Phú Quý 1kg"]));
    setSilverPhuQuyLuong(format2(s["Phú Quý 1 lượng"]));
  }, [brandPrices]);

  function openCreateAssetType(assetType: "savings" | "lending") {
    setEditId(null);
    pendingCreateToDeleteIdRef.current = null;
    editDeleteModeRef.current = null;
    setForm({ ...getDefaultForm(), assetType, unit: ASSET_UNITS[assetType] });
    setDialogOpen(true);
  }

  function parseDecimalInput(raw: string): number {
    const s0 = String(raw ?? "").trim();
    if (!s0) return NaN;
    // Allow user input like "18,000,000.50" by removing thousand separators.
    // If using comma as decimal separator (and no dot), convert it to dot.
    let s = s0.replace(/\s+/g, "");
    const hasDot = s.includes(".");
    const hasComma = s.includes(",");
    if (hasComma && !hasDot) s = s.replace(",", ".");
    // Remove all commas (thousand separators) and keep only digits + dot.
    s = s.replace(/,/g, "");
    s = s.replace(/[^0-9.]/g, "");
    // Keep at most one dot
    const firstDot = s.indexOf(".");
    if (firstDot >= 0) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  const createMutation = trpc.investment.create.useMutation({
    onSuccess: (data) => {
      utils.investment.list.invalidate();

      const pendingDeleteId = pendingCreateToDeleteIdRef.current;
      if (pendingDeleteId != null) {
        // Edit flow: create new record, then soft-delete the old one.
        pendingCreateToDeleteIdRef.current = null;
        setDialogOpen(false);
        setEditId(null);
        setForm(getDefaultForm());

        editDeleteModeRef.current = "edit";
        deleteMutation.mutate({ id: pendingDeleteId });
        return;
      }

      toast.success("Đã thêm khoản đầu tư");
      setDialogOpen(false);
      setForm(getDefaultForm());
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.investment.delete.useMutation({
    onSuccess: () => {
      utils.investment.list.invalidate();
      const mode = editDeleteModeRef.current;
      if (mode === "edit") toast.success("Đã cập nhật lệnh đầu tư");
      else toast.success("Đã xóa khoản đầu tư");
      editDeleteModeRef.current = null;
    },
    onError: (e) => toast.error(e.message),
  });

  const totalInvested = investments.reduce((s, inv) => s + Number(inv.totalInvested), 0);
  const totalCurrentValue = investments.reduce((sum, inv) => {
    let cv = Number(inv.totalInvested);
    if (inv.assetType === "gold" && inv.quantity) {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const brand = String(meta.brand ?? "");
      const price = (brandPrices as any)?.gold?.[brand];
      if (typeof price === "number" && price > 0) cv = Number(inv.quantity) * price;
      else if (marketPrices?.gold && Number(inv.quantity) > 0) {
        const unit = String(inv.unit ?? "").toLowerCase();
        const qty = Number(inv.quantity);
        cv = (unit.includes("ch") || unit.includes("chỉ") || unit.includes("chi")) ? (qty / 10) * marketPrices.gold : qty * marketPrices.gold;
      }
    }
    if (inv.assetType === "silver" && inv.quantity) {
      const unit = String(inv.unit ?? "");
      const phuQuyKey = unit.toLowerCase().includes("kg") ? "Phú Quý 1kg" : "Phú Quý 1 lượng";
      const price = (brandPrices as any)?.silver?.[phuQuyKey];
      if (typeof price === "number" && price > 0) cv = Number(inv.quantity) * price;
      else if (marketPrices?.silver && Number(inv.quantity) > 0) {
        const qty = Number(inv.quantity);
        const u = unit.toLowerCase();
        const grams = u.includes("kg") ? qty * 1000 : u.includes("lượng") ? qty * 37.5 : qty;
        cv = grams * marketPrices.silver;
      }
    }
    if (inv.assetType === "savings" || inv.assetType === "lending") {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const ratePct = Number(meta.rate_pct ?? 0);
      if (ratePct > 0) {
        const principal = Number(inv.totalInvested);
        const daysElapsed = Math.max(0, Math.floor(
          (Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ));
        cv = principal + Math.round(principal * (ratePct / 100) * (daysElapsed / 365));
      }
    }
    return sum + cv;
  }, 0);
  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const goldInvestments = investments
    .filter((inv) => inv.assetType === "gold")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const silverInvestments = investments
    .filter((inv) => inv.assetType === "silver")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const savingsInvestments = investments
    .filter((inv) => inv.assetType === "savings")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lendingInvestments = investments
    .filter((inv) => inv.assetType === "lending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const quantityNum = parseFloat(form.quantity) || 0;
  const unitPriceNum = parseDecimalInput(form.unitPrice) || 0;
  const totalCalculated = quantityNum * unitPriceNum;
  const isSilverKgBrand = form.assetType === "silver" && form.brand.toLowerCase().includes("kg");
  const quantityUnitLabel = form.assetType === "gold"
    ? "chỉ"
    : isSilverKgBrand
      ? "kg"
      : "lượng";

  function getCurrentValue(inv: Investment): number {
    if (inv.assetType === "gold" && inv.quantity) {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const brand = String(meta.brand ?? "");
      const price = (brandPrices as any)?.gold?.[brand];
      if (typeof price === "number" && price > 0) return Number(inv.quantity) * price;

      // Fallback for legacy rows
      if (marketPrices?.gold) {
        const unit = String(inv.unit ?? "").toLowerCase();
        const qty = Number(inv.quantity);
        if (qty > 0) {
          return unit.includes("ch") || unit.includes("chỉ") || unit.includes("chi") ? (qty / 10) * marketPrices.gold : qty * marketPrices.gold;
        }
      }
      return Number(inv.totalInvested);
    }
    if (inv.assetType === "silver" && inv.quantity) {
      const unit = String(inv.unit ?? "");
      const phuQuyKey = unit.toLowerCase().includes("kg") ? "Phú Quý 1kg" : "Phú Quý 1 lượng";
      const price = (brandPrices as any)?.silver?.[phuQuyKey];
      if (typeof price === "number" && price > 0) return Number(inv.quantity) * price;

      if (marketPrices?.silver) {
        const qty = Number(inv.quantity);
        if (qty > 0) {
          const u = unit.toLowerCase();
          const grams = u.includes("kg") ? qty * 1000 : u.includes("lượng") ? qty * 37.5 : qty;
          return grams * marketPrices.silver;
        }
      }
      return Number(inv.totalInvested);
    }
    if (inv.assetType === "savings" || inv.assetType === "lending") {
      const meta = (inv.metadata ?? {}) as Record<string, unknown>;
      const ratePct = Number(meta.rate_pct ?? 0);
      if (ratePct > 0) {
        const principal = Number(inv.totalInvested);
        const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24)));
        return principal + Math.round(principal * (ratePct / 100) * (daysElapsed / 365));
      }
    }
    return Number(inv.totalInvested);
  }

  function getAssetSummary(assetType: "gold" | "silver") {
    const list = assetType === "gold" ? goldInvestments : silverInvestments;
    const totalCost = list.reduce((sum, inv) => sum + Number(inv.totalInvested), 0);
    const totalCurrent = list.reduce((sum, inv) => sum + getCurrentValue(inv as Investment), 0);
    const totalQuantity = list.reduce((sum, inv) => sum + Number(inv.quantity ?? 0), 0);
    const totalLots = list.length;
    const pnl = totalCurrent - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const unitLabel = list[0]?.unit ?? (assetType === "gold" ? "chỉ" : "lượng");
    const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const avgCurrent = totalQuantity > 0 ? totalCurrent / totalQuantity : 0;
    return { totalCost, totalCurrent, totalQuantity, totalLots, pnl, pnlPct, unitLabel, avgCost, avgCurrent };
  }

  function openEditInvestment(inv: Investment) {
    setEditId(inv.id);
    pendingCreateToDeleteIdRef.current = inv.id;

    const meta = (inv.metadata ?? {}) as Record<string, unknown>;

    if (inv.assetType === "gold" || inv.assetType === "silver") {
      const purchaseDate = String(meta.purchase_date ?? "").slice(0, 10) || new Date(inv.createdAt).toISOString().slice(0, 10);
      const quantity = inv.quantity != null ? String(inv.quantity) : "";
      const unitPrice =
        meta.unit_price != null
          ? String(meta.unit_price)
          : quantity && Number(quantity) > 0
            ? String(Number(inv.totalInvested) / Number(quantity))
            : "";

      setForm({
        ...getDefaultForm(),
        assetType: inv.assetType,
        brand: String(meta.brand ?? (inv.assetType === "gold" ? "SJC" : "Phú Quý 1kg")),
        purchaseDate,
        quantity,
        unitPrice,
        note: String(meta.note ?? ""),
        unit: inv.unit ?? "",
        totalInvested: inv.totalInvested,
      });
      setDialogOpen(true);
      return;
    }

    if (inv.assetType === "savings") {
      const invTermUnitLabel = String(meta.term_unit ?? "");
      const termUnitKey = (Object.keys(TERM_UNIT_LABELS) as TermUnit[]).find((k) => TERM_UNIT_LABELS[k] === invTermUnitLabel) ?? "month";
      const investedNum = Number(inv.totalInvested);

      setForm({
        ...getDefaultForm(),
        assetType: "savings",
        name: inv.name,
        totalInvested: Number.isFinite(investedNum) ? investedNum.toLocaleString("vi-VN") : String(inv.totalInvested ?? ""),
        ratePct: String(meta.rate_pct ?? ""),
        termValue: meta.term_value != null ? String(meta.term_value) : "",
        termUnit: termUnitKey,
        unit: inv.unit ?? ASSET_UNITS.savings,
      });
      setDialogOpen(true);
      return;
    }

    // lending
    const invTermUnitLabel = String(meta.term_unit ?? "");
    const termUnitKey = (Object.keys(TERM_UNIT_LABELS) as TermUnit[]).find((k) => TERM_UNIT_LABELS[k] === invTermUnitLabel) ?? "month";
    const investedNum = Number(inv.totalInvested);
    setForm({
      ...getDefaultForm(),
      assetType: "lending",
      name: inv.name,
      totalInvested: Number.isFinite(investedNum) ? investedNum.toLocaleString("vi-VN") : String(inv.totalInvested ?? ""),
      lendingRatePct: String(meta.rate_pct ?? ""),
      lendingTermValue: meta.term_value != null ? String(meta.term_value) : "",
      lendingTermUnit: termUnitKey,
      dueDate: String(meta.due_date ?? ""),
      unit: inv.unit ?? ASSET_UNITS.lending,
    });
    setDialogOpen(true);
  }

  function GoldSilverSummary({
    assetType,
    summary,
  }: {
    assetType: "gold" | "silver";
    summary: ReturnType<typeof getAssetSummary>;
  }) {
    const isProfit = summary.pnl >= 0;
    const open = marketCardsOpen[assetType];
    return (
      <div className="space-y-2">
        <div
          className={`rounded-xl px-3 py-2 flex items-center justify-between ${
            isProfit ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span>
              {isProfit ? "Lãi" : "Lỗ"} {isProfit ? "+" : ""}
              {formatVND(summary.pnl)}
            </span>
          </div>
          <Badge className={isProfit ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}>
            {isProfit ? "+" : ""}
            {summary.pnlPct.toFixed(1)}%
          </Badge>
        </div>
        {/* Collapsible market value cards (default: collapse) */}
        <div className="rounded-xl border border-muted/40 bg-muted/15 px-2 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="text-sm font-bold text-muted-foreground">
              {assetType === "gold" ? "Vàng" : "Bạc"}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMarketCardsOpen((prev) => ({ ...prev, [assetType]: !prev[assetType] }))}
              aria-label={open ? "Thu gọn" : "Mở rộng"}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {open && (
            <div className="mt-2 px-2 pb-1 grid grid-cols-2 gap-2">
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Tổng chi phí</p>
                  <p className="font-bold num text-lg">{formatVND(summary.totalCost)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    TB/{summary.unitLabel}: {formatVND(summary.avgCost)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Giá trị hiện tại</p>
                  <p className="font-bold num text-lg">{formatVND(summary.totalCurrent)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    TB/{summary.unitLabel}: {formatVND(summary.avgCurrent)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Tổng số lượng</p>
                  <p className="font-bold num text-lg">
                    {summary.totalQuantity.toFixed(2)} {summary.unitLabel}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Tích lũy</p>
                  <p className="font-bold num text-lg">{summary.totalLots} lần</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  function GoldSilverHistory({
    assetType,
    list,
  }: {
    assetType: "gold" | "silver";
    list: Investment[];
  }) {
    const brandUpdatedAt = (brandPrices as any)?.updatedAtByAsset?.[assetType];
    const fallbackUpdatedAt =
      assetType === "gold"
        ? (marketPrices as any)?.goldUpdatedAt ?? marketPrices?.updatedAt
        : (marketPrices as any)?.silverUpdatedAt ?? marketPrices?.updatedAt;
    const priceUpdatedAt = brandUpdatedAt ?? fallbackUpdatedAt ?? null;

    if (list.length === 0) {
      return <p className="text-xs text-muted-foreground">Chưa có lệnh {assetType === "gold" ? "vàng" : "bạc"}.</p>;
    }

    return (
      <div className="space-y-2">
        {list.map((inv) => {
          const invested = Number(inv.totalInvested);
          const current = getCurrentValue(inv);
          const pnl = current - invested;
          const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
          const meta = (inv.metadata ?? {}) as Record<string, unknown>;
          const purchaseDate = String(meta.purchase_date ?? "").slice(0, 10) || new Date(inv.createdAt).toISOString().slice(0, 10);
          const purchaseDateObj = new Date(`${purchaseDate}T00:00:00`);
          const comparedDateObj = priceUpdatedAt ? new Date(priceUpdatedAt) : new Date();
          const daysChanged = Number.isNaN(purchaseDateObj.getTime())
            ? 0
            : daysBetweenDates(purchaseDateObj, comparedDateObj);
          const comparedDateLabel = Number.isNaN(comparedDateObj.getTime())
            ? "Hôm nay"
            : comparedDateObj.toISOString().slice(0, 10);
          const brand = String(meta.brand ?? "Không rõ");
          const isProfit = pnl >= 0;

          return (
            <Card key={inv.id} className="border bg-muted/10">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{purchaseDate}</span>
                      <span>{assetType === "gold" ? "🥇" : "🥈"}</span>
                      <Badge variant="outline" className="text-[11px]">{brand}</Badge>
                    </div>
                    <p className="text-sm font-medium">{inv.name}</p>
                  </div>

                  {/* Edit / Delete on the same row as heading */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const note = String(meta.note ?? "");
                        toast.info(note ? `Ghi chú: ${note}` : `Xem chi tiết: ${inv.name}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditInvestment(inv)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (!confirm("Xóa lệnh đầu tư này?")) return;
                        editDeleteModeRef.current = "delete";
                        deleteMutation.mutate({ id: inv.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Số lượng: {inv.quantity ?? 0} {inv.unit ?? ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cập nhật giá: <span className="font-medium text-foreground">{comparedDateLabel}</span>
                  {" · "}
                  <span>{daysChanged} ngày từ lúc mua</span>
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-muted-foreground">Giá gốc</p>
                    <p className="font-semibold num">{formatVND(invested)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-muted-foreground">Hiện tại</p>
                    <p className="font-semibold num">{formatVND(current)}</p>
                  </div>
                </div>

                <div
                  className={`rounded-lg p-2 text-xs font-semibold flex items-center justify-between ${
                    isProfit ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>
                      {isProfit ? "Lãi" : "Lỗ"} {isProfit ? "+" : ""}
                      {formatVND(pnl)}
                    </span>
                  </div>
                  <span className="shrink-0">
                    {isProfit ? "+" : ""}
                    {pnlPct.toFixed(2)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  function GoldSilverLegacyList({
    assetType,
    list,
  }: {
    assetType: "gold" | "silver";
    list: Investment[];
  }) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {list.map((inv) => (
          <InvestmentCard
            key={inv.id}
            inv={inv}
            brandPrices={brandPrices ?? null}
            marketPrices={marketPrices ?? null}
            onDelete={(id) => {
              if (!confirm("Xóa khoản đầu tư này?")) return;
              editDeleteModeRef.current = "delete";
              deleteMutation.mutate({ id });
            }}
          />
        ))}
      </div>
    );
  }

  function handleSubmit() {
    if (form.assetType === "gold" || form.assetType === "silver") {
      if (!form.brand) return toast.error("Vui lòng chọn thương hiệu");
      if (!form.purchaseDate) return toast.error("Vui lòng chọn ngày mua");
      if (quantityNum <= 0) return toast.error("Số lượng không hợp lệ");
      if (unitPriceNum <= 0) return toast.error("Đơn giá không hợp lệ");
      if (totalCalculated <= 0) return toast.error("Thành tiền không hợp lệ");

      const metadata: Record<string, unknown> = {
        brand: form.brand,
        purchase_date: form.purchaseDate,
        unit_price: unitPriceNum,
        quantity_unit: quantityUnitLabel,
      };
      if (form.note.trim()) metadata.note = form.note.trim();

      const autoName = `${form.assetType === "gold" ? "Vàng" : "Bạc"} ${form.brand}`.trim();
      createMutation.mutate({
        name: autoName,
        assetType: form.assetType,
        quantity: quantityNum,
        unit: quantityUnitLabel,
        totalInvested: totalCalculated,
        metadata,
      });
      return;
    }

    if (!form.name.trim()) return toast.error("Tên khoản đầu tư không được để trống");
    const investedNum = parseFormattedNumber(form.totalInvested);
    if (investedNum <= 0) return toast.error("Số tiền đầu tư không hợp lệ");

    const metadata: Record<string, unknown> = {};
    if (form.assetType === "savings") {
      if (form.ratePct) metadata.rate_pct = parseFloat(form.ratePct);
      if (form.termValue) {
        metadata.term_value = parseFloat(form.termValue);
        metadata.term_unit = TERM_UNIT_LABELS[form.termUnit];
      }
    }
    if (form.assetType === "lending") {
      if (form.lendingRatePct) metadata.rate_pct = parseFloat(form.lendingRatePct);
      if (form.lendingTermValue) {
        metadata.term_value = parseFloat(form.lendingTermValue);
        metadata.term_unit = TERM_UNIT_LABELS[form.lendingTermUnit];
      }
      if (form.dueDate) metadata.due_date = form.dueDate;
    }

    createMutation.mutate({
      name: form.name,
      assetType: form.assetType,
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      unit: form.unit || ASSET_UNITS[form.assetType],
      totalInvested: investedNum,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Danh mục đầu tư</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{investments.length} khoản đầu tư · giao diện {INVESTMENT_VIEW_VERSION}</p>
        </div>
        <Button
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => {
            setEditId(null);
            pendingCreateToDeleteIdRef.current = null;
            editDeleteModeRef.current = null;
            setForm(getDefaultForm());
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm khoản đầu tư
        </Button>
      </div>

      <div
        className={`rounded-xl border p-3 ${
          totalPnl >= 0
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{totalPnl >= 0 ? "Danh mục đang có lãi" : "Danh mục đang tạm lỗ"}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tổng đầu tư</p>
            <p className="text-lg font-bold num mt-1">{formatVND(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Giá trị hiện tại</p>
            <p className="text-lg font-bold num mt-1">{formatVND(totalCurrentValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lãi/Lỗ</p>
            <div className={`flex items-center gap-1 mt-1 ${totalPnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <p className="text-lg font-bold num">{totalPnl >= 0 ? "+" : ""}{formatVND(totalPnl)}</p>
              <span className="text-sm">({totalPnlPct.toFixed(1)}%)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lịch sử giao dịch */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Lịch sử giao dịch</h2>
        <Tabs
          value={historyTab}
          onValueChange={(v) =>
            setHistoryTab(v as "gold" | "silver" | "savings" | "lending")
          }
        >
          <TabsList className="w-full justify-between">
            <TabsTrigger value="gold" className="flex-1">🥇 Vàng</TabsTrigger>
            <TabsTrigger value="silver" className="flex-1">🥈 Bạc</TabsTrigger>
            <TabsTrigger value="savings" className="flex-1">🏦 Tiết kiệm</TabsTrigger>
            <TabsTrigger value="lending" className="flex-1">💳 Cho vay</TabsTrigger>
          </TabsList>

          <TabsContent value="gold" className="space-y-3">
            <Card className="border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold">Giá trị thị trường (Vàng)</h3>
                  <p className="text-[11px] text-muted-foreground">Đơn vị: VNĐ/chỉ (nhập giá có thập phân)</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    Theo thương hiệu
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setMarketInputsOpen((prev) => ({
                        ...prev,
                        gold: !prev.gold,
                      }))
                    }
                    aria-label={marketInputsOpen.gold ? "Thu gọn" : "Mở rộng"}
                  >
                    {marketInputsOpen.gold ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {marketInputsOpen.gold && (
                <>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">SJC</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={goldSJC}
                        onChange={(e) => setGoldSJC(e.target.value)}
                        placeholder="VD: 18000000.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">PNJ</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={goldPNJ}
                        onChange={(e) => setGoldPNJ(e.target.value)}
                        placeholder="VD: 18000000.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Doji</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={goldDoji}
                        onChange={(e) => setGoldDoji(e.target.value)}
                        placeholder="VD: 18000000.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Mi Hồng</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={goldMiHong}
                        onChange={(e) => setGoldMiHong(e.target.value)}
                        placeholder="VD: 18000000.00"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      disabled={updateBrandPricesMutation.isPending}
                      onClick={() => {
                        const payloadGold: Record<string, number> = {};
                        const g1 = parseDecimalInput(goldSJC);
                        const g2 = parseDecimalInput(goldPNJ);
                        const g3 = parseDecimalInput(goldDoji);
                        const g4 = parseDecimalInput(goldMiHong);
                        if (Number.isFinite(g1) && g1 > 0) payloadGold["SJC"] = g1;
                        if (Number.isFinite(g2) && g2 > 0) payloadGold["PNJ"] = g2;
                        if (Number.isFinite(g3) && g3 > 0) payloadGold["Doji"] = g3;
                        if (Number.isFinite(g4) && g4 > 0) payloadGold["Mi Hồng"] = g4;
                        if (Object.keys(payloadGold).length === 0) return toast.error("Vui lòng nhập ít nhất 1 giá vàng");
                        updateBrandPricesMutation.mutate({ gold: payloadGold });
                      }}
                    >
                      Lưu giá vàng
                    </Button>
                  </div>
                </>
              )}
            </Card>

            {INVESTMENT_VIEW_VERSION === "v2.1" ? (
              <>
                <GoldSilverSummary assetType="gold" summary={getAssetSummary("gold")} />
                <GoldSilverHistory assetType="gold" list={goldInvestments} />
              </>
            ) : (
              <GoldSilverLegacyList assetType="gold" list={goldInvestments} />
            )}
          </TabsContent>

          <TabsContent value="silver" className="space-y-3">
            <Card className="border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold">Giá trị thị trường (Bạc)</h3>
                  <p className="text-[11px] text-muted-foreground">Đơn vị: VNĐ/kg và VNĐ/lượng</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    Theo thương hiệu
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setMarketInputsOpen((prev) => ({
                        ...prev,
                        silver: !prev.silver,
                      }))
                    }
                    aria-label={marketInputsOpen.silver ? "Thu gọn" : "Mở rộng"}
                  >
                    {marketInputsOpen.silver ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {marketInputsOpen.silver && (
                <>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Phú Quý 1kg</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={silverPhuQuyKg}
                        onChange={(e) => setSilverPhuQuyKg(e.target.value)}
                        placeholder="VD: 25000000.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Phú Quý 1 lượng</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={silverPhuQuyLuong}
                        onChange={(e) => setSilverPhuQuyLuong(e.target.value)}
                        placeholder="VD: 2500000.00"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      disabled={updateBrandPricesMutation.isPending}
                      onClick={() => {
                        const payloadSilver: Record<string, number> = {};
                        const s1 = parseDecimalInput(silverPhuQuyKg);
                        const s2 = parseDecimalInput(silverPhuQuyLuong);
                        if (Number.isFinite(s1) && s1 > 0) payloadSilver["Phú Quý 1kg"] = s1;
                        if (Number.isFinite(s2) && s2 > 0) payloadSilver["Phú Quý 1 lượng"] = s2;
                        if (Object.keys(payloadSilver).length === 0) return toast.error("Vui lòng nhập ít nhất 1 giá bạc");
                        updateBrandPricesMutation.mutate({ silver: payloadSilver });
                      }}
                    >
                      Lưu giá bạc
                    </Button>
                  </div>
                </>
              )}
            </Card>

            {INVESTMENT_VIEW_VERSION === "v2.1" ? (
              <>
                <GoldSilverSummary assetType="silver" summary={getAssetSummary("silver")} />
                <GoldSilverHistory assetType="silver" list={silverInvestments} />
              </>
            ) : (
              <GoldSilverLegacyList assetType="silver" list={silverInvestments} />
            )}
          </TabsContent>

          <TabsContent value="savings" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground">Các lệnh tiết kiệm</h3>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => openCreateAssetType("savings")}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Tạo mới
              </Button>
            </div>
            {savingsInvestments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có lệnh tiết kiệm.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savingsInvestments.map((inv) => (
                  <InvestmentCard
                    key={inv.id}
                    inv={inv as Investment}
                    brandPrices={brandPrices ?? null}
                    marketPrices={marketPrices ?? null}
                    onDelete={(id) => {
                      editDeleteModeRef.current = "delete";
                      if (confirm("Xóa khoản đầu tư này?")) deleteMutation.mutate({ id });
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lending" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-muted-foreground">Các lệnh cho vay</h3>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => openCreateAssetType("lending")}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Tạo mới
              </Button>
            </div>
            {lendingInvestments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có lệnh cho vay.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lendingInvestments.map((inv) => (
                  <InvestmentCard
                    key={inv.id}
                    inv={inv as Investment}
                    brandPrices={brandPrices ?? null}
                    marketPrices={marketPrices ?? null}
                    onDelete={(id) => {
                      editDeleteModeRef.current = "delete";
                      if (confirm("Xóa khoản đầu tư này?")) deleteMutation.mutate({ id });
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create BottomSheet */}
      <Drawer
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditId(null);
            pendingCreateToDeleteIdRef.current = null;
            editDeleteModeRef.current = null;
          }
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{editId ? "Sửa lệnh đầu tư" : "Tạo mới khoản đầu tư"}</DrawerTitle>
            <DrawerDescription>
              {editId ? "Chỉnh sửa thông tin lệnh và lưu lại." : "Nhập thông tin vàng, bạc, tiết kiệm hoặc cho vay để lưu danh mục."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 max-h-[65vh] overflow-y-auto space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">1. Phân loại tài sản</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["gold", "silver", "savings", "lending"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm({
                      ...form,
                      assetType: type,
                      brand: type === "gold" ? "SJC" : type === "silver" ? "Phú Quý 1kg" : form.brand,
                      unit: ASSET_UNITS[type],
                    })}
                    className={`flex items-center justify-center gap-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      form.assetType === type
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    <span>{ASSET_TYPE_ICONS[type]}</span>
                    <span>{ASSET_TYPE_LABELS[type]}</span>
                  </button>
                ))}
              </div>
            </div>

            {(form.assetType === "gold" || form.assetType === "silver") ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">2. Thương hiệu</Label>
                  <Select
                    value={form.brand}
                    onValueChange={(v) => setForm({ ...form, brand: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn thương hiệu" />
                    </SelectTrigger>
                    <SelectContent>
                      {(form.assetType === "gold" ? GOLD_BRANDS : SILVER_BRANDS).map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">3. Ngày mua</Label>
                  <Input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    4. {form.assetType === "gold" ? "Số lượng (chỉ)" : `Số lượng (${quantityUnitLabel})`}
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="VD: 0.5"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    5. Đơn giá (đ/{quantityUnitLabel})
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="VD: 18.000.000,50"
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">6. Ghi chú</Label>
                  <Textarea
                    placeholder="Nhập ghi chú (tùy chọn)"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Thành tiền (tự tính)</p>
                  <p className="text-base font-semibold num">{formatVND(totalCalculated)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(quantityNum || 0).toLocaleString("vi-VN")} x {formatVND(unitPriceNum || 0)} = {formatVND(totalCalculated || 0)}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tên khoản đầu tư *</Label>
                  <Input
                    placeholder={
                      form.assetType === "savings"
                        ? "VD: Tiết kiệm Vietcombank 6 tháng"
                        : "VD: Cho vay ngắn hạn"
                    }
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Số tiền (VNĐ) *</Label>
                  <MoneyInput
                    value={form.totalInvested}
                    onChange={(v) => setForm({ ...form, totalInvested: v })}
                    placeholder="50.000.000"
                  />
                </div>

                {form.assetType === "savings" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Lãi suất (%/năm)</Label>
                      <Input
                        type="number"
                        placeholder="VD: 6.5"
                        value={form.ratePct}
                        onChange={(e) => setForm({ ...form, ratePct: e.target.value })}
                        step="0.1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Số kỳ hạn</Label>
                        <Input
                          type="number"
                          placeholder="VD: 12"
                          value={form.termValue}
                          onChange={(e) => setForm({ ...form, termValue: e.target.value })}
                          min="1"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Đơn vị</Label>
                        <Select value={form.termUnit} onValueChange={(v) => setForm({ ...form, termUnit: v as TermUnit })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Tuần</SelectItem>
                            <SelectItem value="month">Tháng</SelectItem>
                            <SelectItem value="year">Năm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {form.assetType === "lending" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Lãi suất (%/năm)</Label>
                      <Input
                        type="number"
                        placeholder="VD: 12"
                        value={form.lendingRatePct}
                        onChange={(e) => setForm({ ...form, lendingRatePct: e.target.value })}
                        step="0.1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Số kỳ hạn</Label>
                        <Input
                          type="number"
                          placeholder="VD: 3"
                          value={form.lendingTermValue}
                          onChange={(e) => setForm({ ...form, lendingTermValue: e.target.value })}
                          min="1"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Đơn vị</Label>
                        <Select value={form.lendingTermUnit} onValueChange={(v) => setForm({ ...form, lendingTermUnit: v as TermUnit })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Tuần</SelectItem>
                            <SelectItem value="month">Tháng</SelectItem>
                            <SelectItem value="year">Năm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Ngày đáo hạn (tùy chọn)</Label>
                      <Input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DrawerFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditId(null);
                  pendingCreateToDeleteIdRef.current = null;
                  editDeleteModeRef.current = null;
                }}
              >
                Hủy
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>Lưu</Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
