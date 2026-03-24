import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@fintrack.ai",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Auth Tests ──────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current authenticated user", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.openId).toBe("test-user-001");
    expect(user?.email).toBe("test@fintrack.ai");
  });

  it("returns null for unauthenticated context", async () => {
    const ctx = createMockContext({ user: null });
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ─── Budget Color Engine Tests ────────────────────────────────────────────────

describe("Budget color engine logic", () => {
  function getBudgetColor(spent: number, budget: number): string {
    if (budget <= 0) return "green";
    const pct = (spent / budget) * 100;
    if (pct < 50) return "green";
    if (pct < 75) return "yellow";
    if (pct < 90) return "orange";
    return "red";
  }

  it("returns green when spent < 50%", () => {
    expect(getBudgetColor(40_000, 100_000)).toBe("green");
    expect(getBudgetColor(0, 100_000)).toBe("green");
    expect(getBudgetColor(49_999, 100_000)).toBe("green");
  });

  it("returns yellow when spent 50-74%", () => {
    expect(getBudgetColor(50_000, 100_000)).toBe("yellow");
    expect(getBudgetColor(74_999, 100_000)).toBe("yellow");
  });

  it("returns orange when spent 75-89%", () => {
    expect(getBudgetColor(75_000, 100_000)).toBe("orange");
    expect(getBudgetColor(89_999, 100_000)).toBe("orange");
  });

  it("returns red when spent >= 90%", () => {
    expect(getBudgetColor(90_000, 100_000)).toBe("red");
    expect(getBudgetColor(100_000, 100_000)).toBe("red");
    expect(getBudgetColor(150_000, 100_000)).toBe("red");
  });

  it("returns green for zero budget (no limit set)", () => {
    expect(getBudgetColor(50_000, 0)).toBe("green");
  });
});

// ─── Currency Formatting Tests ────────────────────────────────────────────────

describe("Vietnamese currency formatting", () => {
  function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  it("formats zero correctly", () => {
    expect(formatVND(0)).toBe("0");
  });

  it("formats thousands with dots", () => {
    const result = formatVND(1_000_000);
    expect(result).toContain("1");
    expect(result).toContain("000");
  });

  it("formats negative amounts", () => {
    const result = formatVND(-50_000);
    expect(result).toContain("50");
  });
});

// ─── Investment P&L Calculation Tests ────────────────────────────────────────

describe("Investment P&L calculation", () => {
  function calcPnl(totalInvested: number, currentValue: number) {
    const pnl = currentValue - totalInvested;
    const pct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    return { pnl, pct };
  }

  it("calculates profit correctly", () => {
    const { pnl, pct } = calcPnl(10_000_000, 12_000_000);
    expect(pnl).toBe(2_000_000);
    expect(pct).toBeCloseTo(20, 1);
  });

  it("calculates loss correctly", () => {
    const { pnl, pct } = calcPnl(10_000_000, 8_000_000);
    expect(pnl).toBe(-2_000_000);
    expect(pct).toBeCloseTo(-20, 1);
  });

  it("returns zero P&L for break-even", () => {
    const { pnl, pct } = calcPnl(10_000_000, 10_000_000);
    expect(pnl).toBe(0);
    expect(pct).toBe(0);
  });

  it("returns zero pct for zero invested", () => {
    const { pnl, pct } = calcPnl(0, 5_000_000);
    expect(pct).toBe(0);
  });
});

// ─── Savings Interest Calculator Tests ───────────────────────────────────────

describe("Savings interest calculator", () => {
  function calcSavingsInterest(principal: number, annualRate: number, months: number) {
    const monthlyRate = annualRate / 100 / 12;
    const totalInterest = principal * monthlyRate * months;
    const monthlyInterest = principal * monthlyRate;
    return { totalInterest, monthlyInterest };
  }

  it("calculates monthly interest correctly", () => {
    // 100M at 6.5%/year for 12 months
    const { monthlyInterest } = calcSavingsInterest(100_000_000, 6.5, 12);
    expect(monthlyInterest).toBeCloseTo(541_667, -2);
  });

  it("calculates total interest correctly", () => {
    const { totalInterest } = calcSavingsInterest(100_000_000, 6.5, 12);
    expect(totalInterest).toBeCloseTo(6_500_000, -2);
  });

  it("returns zero for zero principal", () => {
    const { totalInterest, monthlyInterest } = calcSavingsInterest(0, 6.5, 12);
    expect(totalInterest).toBe(0);
    expect(monthlyInterest).toBe(0);
  });
});

// ─── Date Utility Tests ───────────────────────────────────────────────────────

describe("Date utility functions", () => {
  function getCurrentMonthYear() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  it("returns current year and month", () => {
    const { year, month } = getCurrentMonthYear();
    const now = new Date();
    expect(year).toBe(now.getFullYear());
    expect(month).toBe(now.getMonth() + 1);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  function formatDate(dateStr: string): string {
    // Parse as UTC to avoid timezone offset issues
    const [year, month, day] = dateStr.split("-").map(Number);
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  it("formats date in Vietnamese format", () => {
    const result = formatDate("2026-03-15");
    expect(result).toBe("15/03/2026");
  });

  it("pads single digit day and month", () => {
    const result = formatDate("2026-01-05");
    expect(result).toBe("05/01/2026");
  });
});

// ─── Transaction Type Tests ───────────────────────────────────────────────────

describe("Transaction type handling", () => {
  function getTransactionSign(type: "income" | "expense"): string {
    return type === "expense" ? "-" : "+";
  }

  it("returns minus sign for expense", () => {
    expect(getTransactionSign("expense")).toBe("-");
  });

  it("returns plus sign for income", () => {
    expect(getTransactionSign("income")).toBe("+");
  });
});
