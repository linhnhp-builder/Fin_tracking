/**
 * shared/currency/index.ts
 *
 * Currency, money, and financial calculation utilities shared between client and server.
 * All functions are pure and have no side effects.
 *
 * Import from either:
 *   - Client: import { formatVND } from "@shared/currency"
 *   - Server: import { formatVND } from "../shared/currency"
 *
 * Design constraints:
 *   - All monetary values in DB are stored as decimal(15,0) — integer VNĐ, no fractions
 *   - Drizzle returns decimal columns as strings — always Number() before arithmetic
 *   - Display formatting uses vi-VN locale (dots as thousand separators)
 *   - Never store floating-point VNĐ amounts; round to nearest integer before saving
 */

/**
 * Format a number as Vietnamese currency with ₫ symbol.
 * Uses vi-VN locale (dots as thousand separators).
 *
 * @example
 * formatVND(1500000)    // "1.500.000 ₫"
 * formatVND("750000")  // "750.000 ₫"
 * formatVND(0)         // "0 ₫"
 */
export function formatVND(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a number with Vietnamese thousand separators (dots), no currency symbol.
 * Use this for input display fields.
 *
 * @example
 * formatNumber(1500000) // "1.500.000"
 * formatNumber(750)     // "750"
 */
export function formatNumber(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("vi-VN").format(num);
}

/**
 * Format a compact large number with Vietnamese suffix (k, tr, tỷ).
 * Use for dashboard widgets where space is limited.
 *
 * @example
 * formatCompact(1500000)      // "1,5 tr"
 * formatCompact(2500000000)   // "2,5 tỷ"
 * formatCompact(50000)        // "50k"
 */
export function formatCompact(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  }
  return `${sign}${abs}`;
}

/**
 * Parse a raw money string from user input into an integer VNĐ amount.
 * Handles: "35k", "1.5tr", "1,500,000", "1.500.000", "35000"
 * Returns 0 if unparseable.
 *
 * @example
 * parseMoneyText("35k")       // 35000
 * parseMoneyText("1.5tr")     // 1500000
 * parseMoneyText("1.500.000") // 1500000
 * parseMoneyText("2tr5")      // 2500000
 */
export function parseMoneyText(text: string): number {
  if (!text) return 0;
  const t = text.trim().toLowerCase();

  // Handle "2tr5" pattern (e.g. 2.5 million)
  const trFive = t.match(/^(\d+)tr(\d+)$/);
  if (trFive) {
    return parseInt(trFive[1]) * 1_000_000 + parseInt(trFive[2]) * 100_000;
  }

  // Handle "1.5tr" or "1,5tr" pattern
  const trDecimal = t.match(/^([\d.,]+)\s*tr$/);
  if (trDecimal) {
    const n = parseFloat(trDecimal[1].replace(",", ".").replace(/\./g, "").replace(",", "."));
    return Math.round(parseFloat(trDecimal[1].replace(",", ".")) * 1_000_000);
  }

  // Handle "35k" pattern
  const kMatch = t.match(/^([\d.,]+)\s*k$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(",", ".")) * 1_000);
  }

  // Handle "1.5m" or "1.5 million" pattern
  const mMatch = t.match(/^([\d.,]+)\s*m(illion)?$/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  }

  // Strip all separators and parse as plain integer
  const cleaned = t.replace(/[.,\s]/g, "").replace(/[^0-9]/g, "");
  return parseInt(cleaned) || 0;
}

/**
 * Get the CSS color string for a budget progress percentage.
 * Used by CategoryCard progress bars and Dashboard widgets.
 *
 * Thresholds:
 *   < 60%  → green  (#10B981)
 *   60-85% → yellow (#F59E0B)
 *   85-100%→ orange (#F97316)
 *   ≥ 100% → red    (#EF4444)
 *
 * @example
 * getBudgetProgressColor(45)  // "#10B981"
 * getBudgetProgressColor(70)  // "#F59E0B"
 * getBudgetProgressColor(90)  // "#F97316"
 * getBudgetProgressColor(110) // "#EF4444"
 */
export function getBudgetProgressColor(pctUsed: number): string {
  if (pctUsed >= 100) return "#EF4444"; // red
  if (pctUsed >= 85) return "#F97316";  // orange
  if (pctUsed >= 60) return "#F59E0B";  // yellow
  return "#10B981";                      // green
}

/**
 * Get the colorStatus enum value for a budget percentage.
 * Matches the DB enum: green | yellow | orange | red
 *
 * @example
 * getBudgetColorStatus(45)  // "green"
 * getBudgetColorStatus(110) // "red"
 */
export function getBudgetColorStatus(pctUsed: number): "green" | "yellow" | "orange" | "red" {
  if (pctUsed >= 100) return "red";
  if (pctUsed >= 85) return "orange";
  if (pctUsed >= 60) return "yellow";
  return "green";
}

/**
 * Get a human-readable Vietnamese label for a budget color status.
 *
 * @example
 * getBudgetStatusLabel("red")    // "Vượt ngân sách"
 * getBudgetStatusLabel("orange") // "Gần hết"
 * getBudgetStatusLabel("yellow") // "Chú ý"
 * getBudgetStatusLabel("green")  // "Bình thường"
 */
export function getBudgetStatusLabel(colorStatus: string): string {
  switch (colorStatus) {
    case "red":    return "Vượt ngân sách";
    case "orange": return "Gần hết";
    case "yellow": return "Chú ý";
    default:       return "Bình thường";
  }
}

/**
 * Calculate simple interest for a savings/lending position.
 *
 * @param principal - Principal amount in VNĐ
 * @param annualRatePercent - Annual interest rate (e.g. 7.5 for 7.5%)
 * @param termUnit - "week" | "month" | "year"
 * @param termValue - Number of units
 * @returns Object with interest amount and total value
 *
 * @example
 * calcSimpleInterest(100_000_000, 7.5, "month", 12)
 * // { interest: 7_500_000, total: 107_500_000, interestPerPeriod: 625_000 }
 */
export function calcSimpleInterest(
  principal: number,
  annualRatePercent: number,
  termUnit: "week" | "month" | "year",
  termValue: number
): { interest: number; total: number; interestPerPeriod: number } {
  const annualRate = annualRatePercent / 100;

  let termInYears: number;
  switch (termUnit) {
    case "week":  termInYears = (termValue * 7) / 365; break;
    case "month": termInYears = termValue / 12; break;
    case "year":  termInYears = termValue; break;
  }

  const interest = Math.round(principal * annualRate * termInYears);
  const total = principal + interest;
  const interestPerPeriod = termValue > 0 ? Math.round(interest / termValue) : 0;

  return { interest, total, interestPerPeriod };
}

/**
 * Calculate P&L for a gold/silver position given current market price.
 *
 * @param quantity - Amount in grams or lượng
 * @param avgCost - Average cost per unit in VNĐ
 * @param currentPrice - Current market price per unit in VNĐ
 * @returns Object with P&L amount and percentage
 *
 * @example
 * calcPnL(10, 8_000_000, 8_500_000)
 * // { pnl: 5_000_000, pnlPct: 6.25, currentValue: 85_000_000 }
 */
export function calcPnL(
  quantity: number,
  avgCost: number,
  currentPrice: number
): { pnl: number; pnlPct: number; currentValue: number } {
  const currentValue = Math.round(quantity * currentPrice);
  const costBasis = Math.round(quantity * avgCost);
  const pnl = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { pnl, pnlPct, currentValue };
}

/**
 * Asset type display labels in Vietnamese.
 */
export const ASSET_TYPE_LABELS: Record<string, string> = {
  gold:    "Vàng",
  silver:  "Bạc",
  savings: "Tiết kiệm",
  lending: "Cho vay",
};

/**
 * Asset type emoji icons.
 */
export const ASSET_TYPE_ICONS: Record<string, string> = {
  gold:    "🥇",
  silver:  "🥈",
  savings: "🏦",
  lending: "💳",
};
