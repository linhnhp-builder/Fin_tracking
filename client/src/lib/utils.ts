import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number as Vietnamese currency (e.g. 1.500.000 ₫) */
export function formatVND(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(num);
}

/** Format number with thousand separators */
export function formatNumber(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("vi-VN").format(num);
}

/** Short format for dashboard: 5.000.000 → "5 tr", 1.300.000 → "1,3 tr", 500.000 → "500 k" — dễ đọc, ít lặp "đ". */
export function formatVNDShort(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${(num / 1e9).toFixed(1).replace(".", ",")} tỷ`;
  if (abs >= 1e6) return `${(num / 1e6).toFixed(1).replace(".", ",")} tr`;
  if (abs >= 1e3) return `${Math.round(num / 1e3)} k`;
  return String(Math.round(num));
}

/** Get budget progress bar color */
export function getBudgetProgressColor(pctUsed: number): string {
  if (pctUsed >= 100) return "#EF4444";
  if (pctUsed >= 85) return "#F97316";
  if (pctUsed >= 60) return "#F59E0B";
  return "#10B981";
}

/** Get budget status label */
export function getBudgetStatusLabel(colorStatus: string): string {
  switch (colorStatus) {
    case "red": return "Vượt ngân sách";
    case "orange": return "Gần hết";
    case "yellow": return "Chú ý";
    default: return "Bình thường";
  }
}

/** Format date to Vietnamese locale */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Get today's date as YYYY-MM-DD string */
export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

/** Chuẩn hóa giá trị từ API (number | string) thành number — tránh lỗi hiển thị khi API trả string. */
export function ensureNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Get current month/year */
export function getCurrentMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Generate a random session ID */
export function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/** Asset type labels */
export const ASSET_TYPE_LABELS: { [key: string]: string } = {
  gold: "Vàng",
  silver: "Bạc",
  savings: "Tiết kiệm",
  lending: "Cho vay",
};

/** Asset type icons */
export const ASSET_TYPE_ICONS: { [key: string]: string } = {
  gold: "🥇",
  silver: "🥈",
  savings: "🏦",
  lending: "💳",
};
