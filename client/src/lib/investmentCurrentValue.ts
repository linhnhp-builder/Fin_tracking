/**
 * Ước tính giá trị hiện tại (VNĐ) cho một khoản đầu tư — đồng bộ với Investments / Dashboard.
 */

export type InvestmentForValuation = {
  assetType: "gold" | "silver" | "savings" | "lending" | "realestate";
  quantity: string | null;
  unit: string | null;
  totalInvested: string;
  metadata: unknown;
  createdAt: Date | string;
};

export function computeInvestmentCurrentValue(
  inv: InvestmentForValuation,
  marketPrices: { gold: number; silver: number } | null | undefined
): number {
  if (inv.assetType === "gold" && inv.quantity) {
    const unit = String(inv.unit ?? "").toLowerCase();
    const qty = Number(inv.quantity);
    if (marketPrices?.gold && qty > 0) {
      if (unit.includes("ch") || unit.includes("chỉ") || unit.includes("chi")) {
        return (qty / 10) * marketPrices.gold;
      }
      return qty * marketPrices.gold;
    }

    return Number(inv.totalInvested);
  }
  if (inv.assetType === "silver" && inv.quantity) {
    const qty = Number(inv.quantity);
    if (marketPrices?.silver && qty > 0) {
      const u = String(inv.unit ?? "").toLowerCase();
      const grams =
        u.includes("kg") ? qty * 1000 :
        u.includes("lượng") ? qty * 37.5 :
        qty;
      return grams * marketPrices.silver;
    }

    return Number(inv.totalInvested);
  }
  if (inv.assetType === "savings" || inv.assetType === "lending") {
    const meta = (inv.metadata ?? {}) as Record<string, unknown>;
    const ratePct = Number(meta.rate_pct ?? 0);
    if (ratePct > 0) {
      const principal = Number(inv.totalInvested);
      const daysElapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      );
      const accruedInterest = Math.round(principal * (ratePct / 100) * (daysElapsed / 365));
      return principal + accruedInterest;
    }
  }
  return Number(inv.totalInvested);
}
