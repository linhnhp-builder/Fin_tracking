/**
 * shared/date/index.ts
 *
 * Date and time utilities shared between client and server.
 * All functions are pure and have no side effects.
 *
 * Import from either:
 *   - Client: import { formatDate } from "@shared/date"
 *   - Server: import { formatDate } from "../shared/date"
 *
 * Design constraints:
 *   - All DB date fields are varchar(10) in YYYY-MM-DD format — never Date objects
 *   - All timestamps (createdAt, updatedAt) are UTC; convert to local for display
 *   - Never use timezone-dependent string formatting for storage
 */

/**
 * Format a date string or Date object to Vietnamese locale display format.
 * Output: "12/03/2026" (DD/MM/YYYY)
 *
 * @example
 * formatDate("2026-03-12") // "12/03/2026"
 * formatDate(new Date())   // "12/03/2026"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date string or Date object to short Vietnamese locale display.
 * Output: "12/03" (DD/MM)
 *
 * @example
 * formatDateShort("2026-03-12") // "12/03"
 */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/**
 * Get today's date as a YYYY-MM-DD string (local timezone).
 * Use this for all DB date field writes — never store Date objects.
 *
 * @example
 * todayString() // "2026-03-12"
 */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get the current year and month as numbers.
 * Use this for report queries and budget period calculations.
 *
 * @example
 * getCurrentMonthYear() // { year: 2026, month: 3 }
 */
export function getCurrentMonthYear(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Get the first day of the current month as a YYYY-MM-DD string.
 * Used as `periodStart` in budget_limits calculations.
 *
 * @example
 * currentMonthStart() // "2026-03-01"
 */
export function currentMonthStart(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Get the YYYY-MM prefix for the current month.
 * Used in SQL LIKE queries: `transactionDate LIKE 'YYYY-MM-%'`
 *
 * @example
 * currentMonthPrefix() // "2026-03"
 */
export function currentMonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Get the YYYY-MM prefix for a specific year and month.
 *
 * @example
 * monthPrefix(2026, 3) // "2026-03"
 */
export function monthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Calculate the number of days between two YYYY-MM-DD date strings.
 * Returns a positive number regardless of order.
 *
 * @example
 * daysBetween("2026-01-01", "2026-03-12") // 70
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

/**
 * Add a number of months to a YYYY-MM-DD date string.
 * Returns a new YYYY-MM-DD string.
 *
 * @example
 * addMonths("2026-01-15", 3) // "2026-04-15"
 */
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Format a UTC timestamp to a relative time string in Vietnamese.
 * e.g. "2 giờ trước", "vừa xong", "3 ngày trước"
 *
 * @example
 * timeAgo(new Date(Date.now() - 3600000)) // "1 giờ trước"
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return "vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} ngày trước`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} tháng trước`;
  return `${Math.floor(seconds / 31536000)} năm trước`;
}

/**
 * Check if a YYYY-MM-DD date string falls within the current month.
 *
 * @example
 * isCurrentMonth("2026-03-15") // true (if current month is March 2026)
 */
export function isCurrentMonth(dateStr: string): boolean {
  const { year, month } = getCurrentMonthYear();
  return dateStr.startsWith(monthPrefix(year, month));
}
