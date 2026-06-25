import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardDataMock = vi.hoisted(() => vi.fn());
const getCurrentCycleDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics", () => ({
  getDashboardData: getDashboardDataMock,
}));

vi.mock("@/lib/cycles/getCurrentCycle", () => ({
  getCurrentCycleData: getCurrentCycleDataMock,
}));

import { fetchCashflowRunway, serializeCashflowRunway } from "@/lib/assistant/cashflow";

function dec(value: number) {
  return new Prisma.Decimal(value);
}

describe("assistant cashflow runway evidence", () => {
  beforeEach(() => {
    getDashboardDataMock.mockReset();
    getCurrentCycleDataMock.mockReset();
  });

  it("computes runway coverage from cashflow averages and current cycle obligations", async () => {
    getDashboardDataMock.mockResolvedValue({
      totals: {
        cashBalance: 3000,
        monthlyIncome: 2500,
        monthlySpend: 1800,
        netCashflow: 700,
      },
      monthlyCashflow: [
        { month: "Apr", income: 2400, spending: 1800, net: 600 },
        { month: "May", income: 2500, spending: 1900, net: 600 },
        { month: "Jun", income: 2500, spending: 1700, net: 800 },
      ],
    });
    getCurrentCycleDataMock.mockResolvedValue({
      cycle: {
        startDate: new Date("2026-06-15T00:00:00.000Z"),
        endDate: new Date("2026-06-28T00:00:00.000Z"),
      },
      daysRemaining: 5,
      committed: [
        {
          name: "Rent",
          amount: dec(1200),
          accrualPerCycle: dec(600),
          status: "accrued",
          settled: false,
          dueDate: new Date("2026-06-25T00:00:00.000Z"),
        },
        {
          name: "Phone",
          amount: dec(60),
          accrualPerCycle: dec(30),
          status: "debited",
          settled: true,
          dueDate: new Date("2026-06-18T00:00:00.000Z"),
        },
      ],
      pendingSum: dec(44.25),
      safeToSweep: {
        amount: dec(500),
        components: { unsettledAccruals: dec(600) },
      },
      breakdown: { discretionaryRemaining: 250 },
    });

    const result = await fetchCashflowRunway({
      tenantId: "tenant-1",
      tenantSlug: "personal",
    });

    expect(result.monthlyAverage).toEqual({
      months: 3,
      income: 2466.67,
      spend: 1800,
      net: 666.67,
    });
    expect(result.runway.expenseCoverageMonths).toBe(1.67);
    expect(result.runway.netBurnCoverageMonths).toBeNull();
    expect(result.currentCycle.discretionaryDailyRoom).toBe(50);
    expect(result.currentCycle.upcomingBills).toEqual([
      {
        name: "Rent",
        amount: 1200,
        accrualPerCycle: 600,
        status: "accrued",
        dueDate: "2026-06-25",
      },
    ]);

    const block = serializeCashflowRunway(result, "CAD");
    expect(block).toContain("CASHFLOW RUNWAY STATUS");
    expect(block).toContain("expense coverage 1.67 mo");
    expect(block).toContain("UPCOMING / UNSETTLED BILLS THIS CYCLE");
    expect(block).toContain("Rent");
  });
});
