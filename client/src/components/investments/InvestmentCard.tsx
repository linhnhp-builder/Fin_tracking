import { useMemo, useState } from "react";
import { formatVND, ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from "@/lib/utils";
import { computeInvestmentCurrentValue } from "@/lib/investmentCurrentValue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

export type Investment = {
  id: number;
  userId: number;
  name: string;
  assetType: "gold" | "silver" | "savings" | "lending" | "realestate";
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

const ASSET_UNITS: Record<string, string> = {
  gold: "lượng",
  silver: "gram",
  savings: "VNĐ",
  lending: "VNĐ",
  realestate: "VNĐ",
};

export function InvestmentCard({
  inv,
  marketPrices,
  onDelete,
}: {
  inv: Investment;
  marketPrices: { gold: number; silver: number } | null;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const currentValue = useMemo(
    () => computeInvestmentCurrentValue(inv, marketPrices),
    [inv, marketPrices]
  );

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
            <span>Vốn gốc: <span className="num font-medium text-foreground">{formatVND(invested)}</span></span>
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
              type="button"
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
