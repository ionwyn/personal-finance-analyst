import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentCycleDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cycles/getCurrentCycle", () => ({
  getCurrentCycleData: getCurrentCycleDataMock,
}));

import { fetchCycleStatus, serializeCycleStatus } from "@/lib/assistant/cycle";

function dec(value: number) {
  return new Prisma.Decimal(value);
}

function currentCycleData() {
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
      {
        id: "phone",
        name: "Phone",
        amount: dec(60),
        accrualPerCycle: dec(30),
        frequency: "monthly",
        status: "debited",
        settled: true,
        dueDate: new Date("2026-06-18T00:00:00.000Z"),
        settledMethod: null,
        matchedTransactionId: "txn-1",
        hasPattern: true,
      },
    ],
    committedTotalAccrued: dec(670),
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
        {
          category: "Transportation",
          color: "var(--cat-2)",
          amount: 120,
          pct: 16.54,
          delta: null,
          prevAmount: 0,
          prevPct: 0,
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

describe("assistant pay-cycle evidence", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");

  beforeEach(() => {
    getCurrentCycleDataMock.mockReset();
  });

  it("summarizes current pay-cycle data and safe-to-sweep fields", async () => {
    getCurrentCycleDataMock.mockResolvedValue(currentCycleData());

    const result = await fetchCycleStatus("tenant-1", now);

    expect(getCurrentCycleDataMock).toHaveBeenCalledWith("tenant-1", now);
    expect(result).toEqual(
      expect.objectContaining({
        asOf: "2026-06-19",
        settingsConfigured: true,
        cycle: expect.objectContaining({
          startDate: "2026-06-15",
          endDate: "2026-06-28",
          daysRemaining: 10,
          incomeReceived: 2500,
        }),
        safeToSweep: expect.objectContaining({
          amount: 715.75,
          pendingExpenses: 44.25,
          unsettledAccruals: 640,
        }),
        pending: { sum: 44.25, count: 2 },
        discretionary: expect.objectContaining({
          budget: 1330,
          spent: 725.5,
          remaining: 604.5,
          dailyRoom: 60.45,
        }),
      })
    );
    expect(result?.committed.unsettledCount).toBe(2);
    expect(result?.committed.shownItems.map((item) => item.name)).toEqual([
      "Rent",
      "Internet",
      "Phone",
    ]);
    expect(result?.topCategories[0]).toEqual(
      expect.objectContaining({ category: "Food And Drink", amount: 450, delta: 50 })
    );
  });

  it("serializes pay-cycle status as bounded assistant evidence", async () => {
    getCurrentCycleDataMock.mockResolvedValue(currentCycleData());

    const result = await fetchCycleStatus("tenant-1", now);
    const block = serializeCycleStatus(result, "CAD");

    expect(block).toContain("PAY CYCLE STATUS");
    expect(block).toContain("current cycle 2026-06-15 to 2026-06-28");
    expect(block).toContain("Safe to sweep: suggested CAD 715.75");
    expect(block).toContain("Pending transactions: 2");
    expect(block).toContain("Committed expenses: 3 total; 2 unsettled");
    expect(block).toContain("daily room CAD 60.45/day");
    expect(block).toContain("Rent");
    expect(block).not.toContain("cycle-1");
    expect(block).not.toContain("txn-1");
  });

  it("reports a missing active cycle plainly", () => {
    expect(serializeCycleStatus(null, "CAD")).toContain("PAY CYCLE STATUS: none found");
  });
});
