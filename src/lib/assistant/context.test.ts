import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ getDashboardData: vi.fn() }));
vi.mock("@/lib/spending/getSpendingInsight", () => ({ getSpendingInsight: vi.fn() }));

import { getDashboardData } from "@/lib/analytics";
import { buildFinancialFacts, serializeFacts } from "@/lib/assistant/context";
import { getSpendingInsight } from "@/lib/spending/getSpendingInsight";

const mockDash = vi.mocked(getDashboardData);
const mockYtd = vi.mocked(getSpendingInsight);

function dashboard() {
  return {
    totals: {
      currentBalance: 50000,
      cashBalance: 20000,
      investmentBalance: 30000,
      totalLiabilities: 4000,
      monthlyIncome: 6000,
      monthlySpend: 3500,
      netCashflow: 2500,
    },
    insights: {
      savingsRate: 41.6667,
      largestExpense: { name: "Rent", amount: 1800, date: "2026-05-01T00:00:00.000Z" },
      subscriptionsTotal: 95,
      subscriptionsCount: 4,
    },
    currentMonthLabel: "May",
    categorySpendMTD: [{ category: "Food", amount: 800, pct: 22, color: "x" }],
    categorySpend30d: [{ category: "Food", amount: 900, pct: 20, color: "x" }],
    merchantSpend: [{ merchant: "Amazon", amount: 420 }],
    monthlyCashflow: [
      { month: "Apr", income: 6000, spending: 3000, net: 3000 },
      { month: "May", income: 6000, spending: 4000, net: 2000 },
    ],
    investments: {
      summary: { portfolioCAD: 30000, plCAD: 2500, plPct: 9.09 },
      holdings: [
        { symbol: "VFV", mvCAD: 18000, plPct: 12 },
        { symbol: "AAPL", mvCAD: 12000, plPct: 5 },
      ],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("buildFinancialFacts", () => {
  it("annualises YTD figures consistently (model never does this math)", async () => {
    mockDash.mockResolvedValue(dashboard());
    mockYtd.mockResolvedValue({ totalIncome: 30000, totalSpending: 17500 } as never);

    const f = await buildFinancialFacts({ tenantId: "t1", tenantSlug: "personal" });

    // net is income - spend, exactly.
    expect(f.yearToDate.net).toBe(12500);
    // annualised values scale YTD by the same factor → ratios must match.
    const incRatio = f.yearToDate.annualizedIncome / f.yearToDate.income;
    const spdRatio = f.yearToDate.annualizedSpend / f.yearToDate.spend;
    expect(incRatio).toBeCloseTo(spdRatio, 5);
    // and annualised net stays internally consistent (within 2-decimal rounding,
    // since each figure is rounded independently).
    expect(f.yearToDate.annualizedNet).toBeCloseTo(
      f.yearToDate.annualizedIncome - f.yearToDate.annualizedSpend,
      1
    );
    // projecting a partial year forward can only grow the figure.
    expect(f.yearToDate.annualizedIncome).toBeGreaterThanOrEqual(f.yearToDate.income);
  });

  it("averages monthly cashflow over the provided months", async () => {
    mockDash.mockResolvedValue(dashboard());
    mockYtd.mockResolvedValue({ totalIncome: 30000, totalSpending: 17500 } as never);

    const f = await buildFinancialFacts({ tenantId: "t1", tenantSlug: "personal" });
    expect(f.avgMonthly.income).toBe(6000); // (6000+6000)/2
    expect(f.avgMonthly.spend).toBe(3500); // (3000+4000)/2
    expect(f.investments.topHoldings[0].symbol).toBe("VFV"); // sorted by value desc
  });
});

describe("serializeFacts", () => {
  it("emits a readable block with the sign convention and key sections", async () => {
    mockDash.mockResolvedValue(dashboard());
    mockYtd.mockResolvedValue({ totalIncome: 30000, totalSpending: 17500 } as never);

    const f = await buildFinancialFacts({ tenantId: "t1", tenantSlug: "personal" });
    const block = serializeFacts(f);

    expect(block).toContain("SIGN CONVENTION");
    expect(block).toContain("NET WORTH:");
    expect(block).toContain("INVESTMENTS:");
    expect(block).toContain("monthly or periodic return");
    expect(block).toContain("VFV");
  });
});
