import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BudgetStatusResult } from "@/lib/assistant/budget";
import type { CycleStatusResult } from "@/lib/assistant/cycle";
import type { AggregateResult, PeriodComparisonResult } from "@/lib/assistant/query";
import type { RecurringSpendStatusResult } from "@/lib/assistant/recurring";
import type { SavingsGoalStatusResult } from "@/lib/assistant/savings";

const fetchCycleStatusMock = vi.hoisted(() => vi.fn());
const serializeCycleStatusMock = vi.hoisted(() => vi.fn(() => "CYCLE_BLOCK"));
const fetchBudgetStatusMock = vi.hoisted(() => vi.fn());
const serializeBudgetStatusMock = vi.hoisted(() => vi.fn(() => "BUDGET_BLOCK"));
const fetchRecurringSpendStatusMock = vi.hoisted(() => vi.fn());
const serializeRecurringSpendStatusMock = vi.hoisted(() => vi.fn(() => "RECURRING_BLOCK"));
const fetchSavingsGoalStatusMock = vi.hoisted(() => vi.fn());
const serializeSavingsGoalStatusMock = vi.hoisted(() => vi.fn(() => "GOAL_BLOCK"));
const fetchPeriodComparisonMock = vi.hoisted(() => vi.fn());
const serializePeriodComparisonMock = vi.hoisted(() => vi.fn(() => "PERIOD_COMPARISON_BLOCK"));
const fetchTopAggregatesMock = vi.hoisted(() => vi.fn());
const serializeAggregateRowsMock = vi.hoisted(() =>
  vi.fn((result: AggregateResult) => `AGGREGATE_${result.kind.toUpperCase()}_BLOCK`)
);

vi.mock("@/lib/assistant/cycle", () => ({
  fetchCycleStatus: fetchCycleStatusMock,
  serializeCycleStatus: serializeCycleStatusMock,
}));
vi.mock("@/lib/assistant/budget", () => ({
  fetchBudgetStatus: fetchBudgetStatusMock,
  serializeBudgetStatus: serializeBudgetStatusMock,
}));
vi.mock("@/lib/assistant/recurring", () => ({
  fetchRecurringSpendStatus: fetchRecurringSpendStatusMock,
  serializeRecurringSpendStatus: serializeRecurringSpendStatusMock,
}));
vi.mock("@/lib/assistant/savings", () => ({
  fetchSavingsGoalStatus: fetchSavingsGoalStatusMock,
  serializeSavingsGoalStatus: serializeSavingsGoalStatusMock,
}));
vi.mock("@/lib/assistant/query", () => ({
  fetchPeriodComparison: fetchPeriodComparisonMock,
  fetchTopAggregates: fetchTopAggregatesMock,
  serializePeriodComparison: serializePeriodComparisonMock,
  serializeAggregateRows: serializeAggregateRowsMock,
}));

import { fetchSavingsAdvice, serializeSavingsAdvice, type SavingsAdviceResult } from "@/lib/assistant/advice";

function cycleStatus(overrides: {
  safeToSweepAmount?: number;
  discretionaryRemaining?: number;
  discretionaryDailyRoom?: number;
  daysRemaining?: number;
  endDate?: string;
} = {}): CycleStatusResult {
  const {
    safeToSweepAmount = 300,
    discretionaryRemaining = 200,
    discretionaryDailyRoom = 20,
    daysRemaining = 10,
    endDate = "2026-06-28",
  } = overrides;

  return {
    asOf: "2026-06-19",
    settingsConfigured: true,
    cycle: {
      startDate: "2026-06-15",
      endDate,
      daysRemaining,
      incomeReceived: 2500,
      fixedSavingsPull: 500,
      sweptAmount: 250,
      creditCardPaymentDate: null,
    },
    balances: { chequing: 1800, creditCard: 300 },
    safeToSweep: {
      amount: safeToSweepAmount,
      rawAmount: safeToSweepAmount,
      overCommitted: false,
      sweepBuffer: 100,
      pendingExpenses: 44.25,
      unsettledAccruals: 640,
      creditCardBalance: 300,
    },
    pending: { sum: 44.25, count: 2 },
    committed: {
      totalAccrued: 670,
      totalItems: 0,
      settledCount: 0,
      unsettledCount: 0,
      upcomingCount: 0,
      accruedCount: 0,
      debitedCount: 0,
      paidCount: 0,
      shownItems: [],
      hiddenItems: 0,
    },
    discretionary: {
      budget: 1330,
      spent: 725.5,
      remaining: discretionaryRemaining,
      dailyRoom: discretionaryDailyRoom,
    },
    topCategories: [],
  };
}

const budgetStatusFixture: BudgetStatusResult = {
  monthLabel: "June 2026",
  asOf: "2026-06-19",
  daysElapsed: 19,
  daysInMonth: 30,
  daysRemaining: 11,
  monthProgressPct: 63.33,
  warnPct: 80,
  alarmPct: 100,
  rollForward: false,
  totalBudgets: 0,
  shownBudgets: 0,
  matchedCategory: null,
  availableCategories: [],
  totalCap: 0,
  totalSpent: 0,
  totalRemaining: 0,
  totalPct: 0,
  totalExpectedSpendToDate: 0,
  totalPaceDelta: 0,
  totalProjectedMonthEnd: 0,
  overBudgetCount: 0,
  warnBudgetCount: 0,
  overPaceCount: 0,
  rows: [],
};

const recurringStatusFixture: RecurringSpendStatusResult = {
  scope: null,
  confirmed: { count: 0, totalMonthlyEquivalent: 0, totalAccrualPerCycle: 0, rows: [] },
  detectedOutflows: { count: 0, totalMonthlyEquivalent: 0, rows: [] },
  detectedInflows: { count: 0, rows: [] },
};

const periodComparisonFixture: PeriodComparisonResult = {
  current: {
    label: "current month to date",
    from: "2026-06-01",
    to: "2026-06-19",
    amount: 0,
    count: 0,
    avgAmount: 0,
  },
  previous: {
    label: "same period last month",
    from: "2026-05-01",
    to: "2026-05-19",
    amount: 0,
    count: 0,
    avgAmount: 0,
  },
  deltaAmount: 0,
  deltaPct: null,
  deltaCount: 0,
  deltaAvgAmount: 0,
  merchantDrivers: [],
  categoryDrivers: [],
  resolvedCategory: null,
};

function aggregateFixture(kind: "category" | "merchant"): AggregateResult {
  return {
    kind,
    rows: [],
    totalGroups: 0,
    totalTransactions: 0,
    sumAmount: 0,
    resolvedCategory: null,
    truncated: false,
  };
}

const savingsGoalFixture: SavingsGoalStatusResult = {
  asOf: "2026-06-19",
  scope: null,
  totalGoals: 0,
  shownGoals: 0,
  reachedCount: 0,
  totalTarget: 0,
  totalSaved: 0,
  totalRemaining: 0,
  rows: [],
};

describe("fetchSavingsAdvice feasibility", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");

  beforeEach(() => {
    fetchCycleStatusMock.mockReset();
    fetchBudgetStatusMock.mockReset().mockResolvedValue(budgetStatusFixture);
    fetchRecurringSpendStatusMock.mockReset().mockResolvedValue(recurringStatusFixture);
    fetchPeriodComparisonMock.mockReset().mockResolvedValue(periodComparisonFixture);
    fetchTopAggregatesMock
      .mockReset()
      .mockImplementation((_tenantSlug: string, _filters: unknown, kind: "category" | "merchant") =>
        Promise.resolve(aggregateFixture(kind))
      );
    fetchSavingsGoalStatusMock.mockReset().mockResolvedValue(savingsGoalFixture);
  });

  it("is omitted entirely when no targetAmount is given", async () => {
    fetchCycleStatusMock.mockResolvedValue(cycleStatus());

    const result = await fetchSavingsAdvice("tenant-1", "tenant-1", {}, now);

    expect(result.feasibility).toBeNull();
    expect(fetchSavingsGoalStatusMock).not.toHaveBeenCalled();
  });

  it("is feasible when projected available (safe-to-sweep + discretionary remaining) covers the target", async () => {
    fetchCycleStatusMock.mockResolvedValue(
      cycleStatus({ safeToSweepAmount: 300, discretionaryRemaining: 200, daysRemaining: 10 })
    );

    const result = await fetchSavingsAdvice("tenant-1", "tenant-1", { targetAmount: 500 }, now);

    expect(result.feasibility).toEqual(
      expect.objectContaining({
        targetAmount: 500,
        projectedAvailable: 500,
        gap: 0,
        feasible: true,
        requiredDailyCut: null,
      })
    );
  });

  it("is not feasible and computes a required daily cut when the target exceeds projected available", async () => {
    fetchCycleStatusMock.mockResolvedValue(
      cycleStatus({ safeToSweepAmount: 300, discretionaryRemaining: 200, daysRemaining: 10 })
    );

    const result = await fetchSavingsAdvice("tenant-1", "tenant-1", { targetAmount: 800 }, now);

    expect(result.feasibility).toEqual(
      expect.objectContaining({
        targetAmount: 800,
        projectedAvailable: 500,
        gap: 300,
        feasible: false,
        requiredDailyCut: 30,
      })
    );
  });

  it("still computes a (larger) gap when discretionary remaining is already negative", async () => {
    fetchCycleStatusMock.mockResolvedValue(
      cycleStatus({ safeToSweepAmount: 300, discretionaryRemaining: -50, daysRemaining: 10 })
    );

    const result = await fetchSavingsAdvice("tenant-1", "tenant-1", { targetAmount: 500 }, now);

    expect(result.feasibility).toEqual(
      expect.objectContaining({ projectedAvailable: 250, gap: 250, feasible: false, requiredDailyCut: 25 })
    );
  });

  it("reports feasibility as unavailable when no pay cycle is configured", async () => {
    fetchCycleStatusMock.mockResolvedValue(null);

    const result = await fetchSavingsAdvice("tenant-1", "tenant-1", { targetAmount: 500 }, now);

    expect(result.feasibility).toEqual({
      targetAmount: 500,
      unavailable: true,
      reason: "no pay cycle is configured",
    });
  });

  it("only fetches a savings goal when the question names one", async () => {
    fetchCycleStatusMock.mockResolvedValue(cycleStatus());

    await fetchSavingsAdvice("tenant-1", "tenant-1", { q: "Stage 2" }, now);

    expect(fetchSavingsGoalStatusMock).toHaveBeenCalledWith("tenant-1", { q: "Stage 2" }, now);
  });
});

describe("serializeSavingsAdvice", () => {
  function adviceResult(overrides: Partial<SavingsAdviceResult> = {}): SavingsAdviceResult {
    return {
      asOf: "2026-06-19",
      feasibility: null,
      cycle: cycleStatus(),
      budget: budgetStatusFixture,
      recurring: recurringStatusFixture,
      periodComparison: periodComparisonFixture,
      topCategories: aggregateFixture("category"),
      topMerchants: aggregateFixture("merchant"),
      goal: null,
      ...overrides,
    };
  }

  it("puts the FEASIBILITY line first, before the reused sub-blocks", () => {
    const block = serializeSavingsAdvice(
      adviceResult({
        feasibility: {
          targetAmount: 500,
          cycleEndDate: "2026-06-28",
          daysRemaining: 10,
          projectedAvailable: 500,
          gap: 0,
          feasible: true,
          requiredDailyCut: null,
          dailyDiscretionaryRoom: 20,
        },
      })
    );

    const feasibilityIndex = block.indexOf("FEASIBILITY:");
    expect(feasibilityIndex).toBeGreaterThan(-1);
    expect(feasibilityIndex).toBeLessThan(block.indexOf("CYCLE_BLOCK"));
    expect(feasibilityIndex).toBeLessThan(block.indexOf("BUDGET_BLOCK"));
  });

  it("reuses every sub-serializer's output verbatim instead of re-flattening fields", () => {
    const block = serializeSavingsAdvice(adviceResult());

    expect(block).toContain("CYCLE_BLOCK");
    expect(block).toContain("BUDGET_BLOCK");
    expect(block).toContain("RECURRING_BLOCK");
    expect(block).toContain("PERIOD_COMPARISON_BLOCK");
    expect(block).toContain("AGGREGATE_CATEGORY_BLOCK");
    expect(block).toContain("AGGREGATE_MERCHANT_BLOCK");
  });

  it("omits the FEASIBILITY line and the goal block when neither applies", () => {
    const block = serializeSavingsAdvice(adviceResult());

    expect(block).not.toContain("FEASIBILITY:");
    expect(block).not.toContain("GOAL_BLOCK");
  });

  it("includes the goal block only when a goal was matched", () => {
    const block = serializeSavingsAdvice(adviceResult({ goal: savingsGoalFixture }));

    expect(block).toContain("GOAL_BLOCK");
  });

  it("states an unavailable feasibility verdict plainly instead of omitting it", () => {
    const block = serializeSavingsAdvice(
      adviceResult({ feasibility: { targetAmount: 500, unavailable: true, reason: "no pay cycle is configured" } })
    );

    expect(block).toContain("FEASIBILITY: cannot be assessed for a target of CAD 500");
    expect(block).toContain("no pay cycle is configured");
  });
});
