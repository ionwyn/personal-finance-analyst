import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  plaidTransaction: { findMany: vi.fn() },
}));
const getBudgetGoalDataMock = vi.hoisted(() => vi.fn());
const getCurrentCycleDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/analytics", () => ({
  getTransactionsForTenant: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/budgets/getBudgetGoalData", () => ({
  getBudgetGoalData: getBudgetGoalDataMock,
}));

vi.mock("@/lib/cycles/getCurrentCycle", () => ({
  getCurrentCycleData: getCurrentCycleDataMock,
}));

import { getTransactionsForTenant } from "@/lib/analytics";
import { fetchBudgetStatus, serializeBudgetStatus } from "@/lib/assistant/budget";
import { fetchCycleStatus, serializeCycleStatus } from "@/lib/assistant/cycle";
import { assistantEvalCases, getAssistantEvalCase } from "@/lib/assistant/evals";
import { buildNarrationPrompt, buildPlanPrompt } from "@/lib/assistant/prompt";
import {
  fetchPeriodComparison,
  fetchScopedTransactions,
  fetchTopAggregates,
  planSchema,
  serializeAggregateRows,
  serializePeriodComparison,
  serializeRows,
} from "@/lib/assistant/query";

const mockGetTransactions = vi.mocked(getTransactionsForTenant);

function dbTxn(input: { merchant: string; amount: number; date?: string; category?: string }) {
  return {
    name: input.merchant.toUpperCase(),
    merchantName: input.merchant,
    amount: input.amount,
    date: new Date(`${input.date ?? "2026-06-15"}T12:00:00.000Z`),
    categoryPrimary: input.category ?? "FOOD_AND_DRINK",
    categoryDetailed: null,
    txnType: "expense",
    removed: false,
    supersededById: null,
    account: { tracked: true },
  };
}

function budgetData() {
  return {
    monthLabel: "June 2026",
    warnPct: 85,
    alarmPct: 100,
    rollForward: false,
    budgets: [
      {
        id: "budget-food",
        categoryPrimary: "FOOD_AND_DRINK",
        categoryLabel: "Food and Drink",
        color: "var(--cat-1)",
        cap: 600,
        spent: 450,
        remaining: 150,
        pct: 75,
        status: "under",
      },
      {
        id: "budget-shops",
        categoryPrimary: "SHOPS",
        categoryLabel: "Shops",
        color: "var(--cat-2)",
        cap: 500,
        spent: 525,
        remaining: -25,
        pct: 105,
        status: "over",
      },
    ],
    goals: [],
    totalCap: 1100,
    totalSpent: 975,
    availableCategories: [],
    destinations: [],
  };
}

function dec(value: number) {
  return {
    toNumber: () => value,
  };
}

function cycleData() {
  return {
    cycle: {
      id: "cycle-1",
      startDate: new Date("2026-06-15T00:00:00.000Z"),
      endDate: new Date("2026-06-28T00:00:00.000Z"),
      incomeReceived: dec(2500),
      fixedSavingsPull: dec(500),
      sweptAmount: dec(250),
      creditCardPaymentDate: new Date("2026-06-25T00:00:00.000Z"),
      notes: null,
    },
    daysRemaining: 10,
    committed: [
      {
        id: "rent",
        name: "Rent",
        amount: dec(1200),
        accrualPerCycle: dec(600),
        frequency: "monthly",
        status: "accrued",
        settled: false,
        dueDate: new Date("2026-06-15T00:00:00.000Z"),
        settledMethod: null,
        matchedTransactionId: null,
        hasPattern: true,
      },
      {
        id: "internet",
        name: "Internet",
        amount: dec(80),
        accrualPerCycle: dec(40),
        frequency: "monthly",
        status: "upcoming",
        settled: false,
        dueDate: new Date("2026-06-26T00:00:00.000Z"),
        settledMethod: null,
        matchedTransactionId: null,
        hasPattern: false,
      },
    ],
    committedTotalAccrued: dec(640),
    spentSoFar: dec(725.5),
    pendingSum: dec(44.25),
    pendingCount: 2,
    lastCycleCarryover: dec(100),
    chequingBalance: dec(1800),
    creditCardBalance: dec(300),
    sweepBuffer: dec(100),
    safeToSweep: {
      amount: dec(715.75),
      rawAmount: dec(715.75),
      overCommitted: false,
      components: {
        chequingBalance: dec(1800),
        pendingExpenses: dec(44.25),
        unsettledAccruals: dec(640),
        creditCardBalance: dec(300),
        sweepBuffer: dec(100),
      },
    },
    settingsConfigured: true,
    breakdown: {
      rows: [
        {
          category: "Food And Drink",
          color: "var(--cat-1)",
          amount: 450,
          pct: 62.03,
          delta: 50,
          prevAmount: 400,
          prevPct: 50,
        },
      ],
      total: 725.5,
      previousTotal: 800,
      discretionarySpent: 725.5,
      discretionaryBudget: 1330,
      discretionaryRemaining: 604.5,
    },
  };
}

describe("assistant eval catalog", () => {
  it("has unique ids and valid gold planner outputs", () => {
    const ids = new Set<string>();

    for (const item of assistantEvalCases) {
      expect(item.prompt.trim()).toBeTruthy();
      expect(item.description.trim()).toBeTruthy();
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);

      expect(planSchema.parse(item.expectedPlan)).toEqual(item.expectedPlan);
    }
  });

  it("keeps every gold intent visible in the plan prompt", () => {
    const prompt = buildPlanPrompt("2026-06-18");
    const intents = new Set(assistantEvalCases.map((item) => item.expectedPlan.intent));

    for (const intent of intents) {
      expect(prompt).toContain(intent);
    }
  });

  it("keeps grounding requirements visible in the narration prompt", () => {
    const prompt = buildNarrationPrompt(
      "AS OF: 2026-06-18\nINVESTMENTS:\n- Portfolio value: CAD 10,000",
      "PREVIOUS ANSWER EVIDENCE retained from the prior assistant turn:\nTOP MERCHANTS: test"
    );

    for (const item of assistantEvalCases) {
      for (const phrase of item.groundingMustMention ?? []) {
        expect(prompt).toContain(phrase);
      }
    }
  });
});

describe("assistant eval evidence packets", () => {
  beforeEach(() => {
    mockGetTransactions.mockReset();
    prismaMock.tenant.findUnique.mockReset();
    prismaMock.plaidTransaction.findMany.mockReset();
    getBudgetGoalDataMock.mockReset();
    getCurrentCycleDataMock.mockReset();
  });

  it("produces the expected top merchant aggregate packet", async () => {
    const item = getAssistantEvalCase("custom-range-top-merchants");
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    prismaMock.plaidTransaction.findMany.mockResolvedValue([
      dbTxn({ merchant: "Marche Barcelo Inc.", amount: 879.49 }),
      dbTxn({ merchant: "Amazon", amount: 200 }),
      dbTxn({ merchant: "Amazon", amount: 437.49, date: "2026-06-16" }),
      dbTxn({ merchant: "Uber Eats", amount: 285.5 }),
    ]);

    const result = await fetchTopAggregates(
      "personal",
      item.expectedPlan.filters ?? {},
      "merchant",
      5,
      new Date("2026-06-18T12:00:00.000Z")
    );
    const block = serializeAggregateRows(result, "CAD");

    expect(result.rows.map((row) => [row.label, row.amount, row.count])).toEqual([
      ["Marche Barcelo Inc.", 879.49, 1],
      ["Amazon", 637.49, 2],
      ["Uber Eats", 285.5, 1],
    ]);
    expect(block).toContain("TOP MERCHANTS");
    expect(block).toContain("server-computed totals");
    expect(block).toContain("source row: 2026-06-15 | Marche Barcelo Inc.");
  });

  it("produces the expected merchant breakdown transaction packet", async () => {
    const item = getAssistantEvalCase("merchant-breakdown-followup");
    mockGetTransactions.mockResolvedValue({
      rows: [
        {
          id: "txn-1",
          name: "Marche Barcelo Inc.",
          rawName: "MARCHE BARCELO",
          account: "Checking",
          accountId: "acct-1",
          date: "2026-06-15T12:00:00.000Z",
          authorizedDate: undefined,
          amount: 879.49,
          category: "FOOD_AND_DRINK",
          categoryColor: "var(--cat-1)",
          detailedCategory: null,
          pending: false,
          bucket: "spending",
        },
      ],
      total: 1,
    } as never);

    const result = await fetchScopedTransactions(
      "personal",
      item.expectedPlan.filters ?? {},
      new Date("2026-06-18T12:00:00.000Z")
    );
    const block = serializeRows(result, "CAD");

    expect(mockGetTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantSlug: "personal",
        q: "Marche Barcelo",
        from: "2026-06-01",
        to: "2026-06-18",
        bucket: "spending",
      })
    );
    expect(block).toContain("MATCHING TRANSACTIONS");
    expect(block).toContain("combined total of all 1 = CAD 879.49");
    expect(block).toContain("2026-06-15 | Marche Barcelo Inc.");
  });

  it("produces the expected period comparison packet", async () => {
    const item = getAssistantEvalCase("spending-period-comparison");
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    prismaMock.plaidTransaction.findMany
      .mockResolvedValueOnce([
        dbTxn({ merchant: "Amazon", amount: 500, date: "2026-06-12", category: "SHOPS" }),
        dbTxn({ merchant: "Grocery", amount: 100, date: "2026-06-13" }),
      ])
      .mockResolvedValueOnce([
        dbTxn({ merchant: "Amazon", amount: 200, date: "2026-05-12", category: "SHOPS" }),
        dbTxn({ merchant: "Grocery", amount: 150, date: "2026-05-13" }),
      ]);

    const result = await fetchPeriodComparison(
      "personal",
      item.expectedPlan.filters ?? {},
      new Date("2026-06-18T12:00:00.000Z")
    );
    const block = serializePeriodComparison(result, "CAD");

    expect(result.deltaAmount).toBe(250);
    expect(result.merchantDrivers[0]).toEqual(
      expect.objectContaining({ label: "Amazon", deltaAmount: 300 })
    );
    expect(block).toContain("PERIOD COMPARISON");
    expect(block).toContain("Change: +CAD 250");
  });

  it("produces the expected budget status packet", async () => {
    const item = getAssistantEvalCase("budget-status-overview");
    getBudgetGoalDataMock.mockResolvedValue(budgetData());

    const result = await fetchBudgetStatus(
      "tenant-1",
      item.expectedPlan.filters ?? {},
      new Date("2026-06-18T12:00:00.000Z")
    );
    const block = serializeBudgetStatus(result, "CAD");

    expect(result.totalCap).toBe(1100);
    expect(result.totalSpent).toBe(975);
    expect(result.overBudgetCount).toBe(1);
    expect(result.overPaceCount).toBe(2);
    expect(block).toContain("BUDGET STATUS");
    expect(block).toContain("budget caps");
    expect(block).toContain("remaining daily room");
    expect(block).toContain("Shops");
  });

  it("produces the expected pay-cycle status packet", async () => {
    const item = getAssistantEvalCase("cycle-safe-to-sweep");
    getCurrentCycleDataMock.mockResolvedValue(cycleData());

    const result = await fetchCycleStatus("tenant-1", new Date("2026-06-19T12:00:00.000Z"));
    const block = serializeCycleStatus(result, "CAD");

    expect(item.expectedPlan.intent).toBe("cycle_status");
    expect(result?.safeToSweep.amount).toBe(715.75);
    expect(result?.committed.unsettledCount).toBe(2);
    expect(block).toContain("PAY CYCLE STATUS");
    expect(block).toContain("Safe to sweep: suggested CAD 715.75");
    expect(block).toContain("Committed expenses");
    expect(block).toContain("daily room CAD 60.45/day");
  });

  it("keeps retained proof evidence available for challenge turns", () => {
    const item = getAssistantEvalCase("prove-prior-answer");
    const block = `PREVIOUS ANSWER EVIDENCE retained from the prior assistant turn:\n${item.priorEvidence}`;
    const prompt = buildNarrationPrompt("AS OF: 2026-06-18", block);

    expect(block).toContain("source row");
    expect(prompt).toContain("PREVIOUS ANSWER EVIDENCE");
    expect(prompt).toContain("Do not say you lack the data");
  });
});
