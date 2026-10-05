import { describe, expect, it, vi, beforeEach } from "vitest";

const getBudgetGoalDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/budgets/getBudgetGoalData", () => ({
  getBudgetGoalData: getBudgetGoalDataMock,
}));

import { fetchBudgetStatus, serializeBudgetStatus } from "@/lib/assistant/budget";

function budget(input: {
  categoryPrimary: string;
  categoryLabel: string;
  cap: number;
  spent: number;
  status?: "under" | "warn" | "over";
}) {
  return {
    id: input.categoryPrimary,
    categoryPrimary: input.categoryPrimary,
    categoryLabel: input.categoryLabel,
    color: "var(--cat-1)",
    cap: input.cap,
    spent: input.spent,
    remaining: input.cap - input.spent,
    pct: input.cap > 0 ? (input.spent / input.cap) * 100 : 0,
    status: input.status ?? "under",
  };
}

function budgetData(budgets: ReturnType<typeof budget>[]) {
  return {
    monthLabel: "June 2026",
    warnPct: 85,
    alarmPct: 100,
    rollForward: false,
    budgets,
    goals: [],
    totalCap: budgets.reduce((sum, item) => sum + item.cap, 0),
    totalSpent: budgets.reduce((sum, item) => sum + item.spent, 0),
    availableCategories: [],
    destinations: [],
  };
}

describe("assistant budget evidence", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  beforeEach(() => {
    getBudgetGoalDataMock.mockReset();
  });

  it("computes spend-to-date, remaining room, burn rate, projection, and pace", async () => {
    getBudgetGoalDataMock.mockResolvedValue(
      budgetData([
        budget({
          categoryPrimary: "FOOD_AND_DRINK",
          categoryLabel: "Food and Drink",
          cap: 600,
          spent: 450,
        }),
        budget({
          categoryPrimary: "TRANSPORTATION",
          categoryLabel: "Transportation",
          cap: 300,
          spent: 120,
        }),
      ])
    );

    const result = await fetchBudgetStatus("tenant-1", {}, now);

    expect(getBudgetGoalDataMock).toHaveBeenCalledWith("tenant-1", now);
    expect(result.daysElapsed).toBe(18);
    expect(result.daysInMonth).toBe(30);
    expect(result.daysRemaining).toBe(12);
    expect(result.totalCap).toBe(900);
    expect(result.totalSpent).toBe(570);
    expect(result.totalRemaining).toBe(330);
    expect(result.totalExpectedSpendToDate).toBe(540);
    expect(result.totalPaceDelta).toBe(30);
    expect(result.totalProjectedMonthEnd).toBe(950);
    expect(result.overPaceCount).toBe(1);

    const food = result.rows.find((row) => row.categoryPrimary === "FOOD_AND_DRINK");
    expect(food).toEqual(
      expect.objectContaining({
        expectedSpendToDate: 360,
        paceDelta: 90,
        paceStatus: "over_pace",
        dailySpendToDate: 25,
        dailyRoomRemaining: 12.5,
        projectedMonthEnd: 750,
      })
    );

    const block = serializeBudgetStatus(result, "CAD");
    expect(block).toContain("BUDGET STATUS");
    expect(block).toContain("Food and Drink");
    expect(block).toContain("remaining CAD 150");
    expect(block).toContain("burn rate CAD 25/day");
    expect(block).toContain("pace +CAD 90");
    expect(block).toContain("projected month-end CAD 750");
  });

  it("filters a specific budget category while keeping totals scoped to the shown rows", async () => {
    getBudgetGoalDataMock.mockResolvedValue(
      budgetData([
        budget({
          categoryPrimary: "FOOD_AND_DRINK",
          categoryLabel: "Food and Drink",
          cap: 600,
          spent: 450,
        }),
        budget({
          categoryPrimary: "TRANSPORTATION",
          categoryLabel: "Transportation",
          cap: 300,
          spent: 120,
        }),
      ])
    );

    const result = await fetchBudgetStatus("tenant-1", { category: "Food and Drink" }, now);

    expect(result.totalBudgets).toBe(2);
    expect(result.shownBudgets).toBe(1);
    expect(result.matchedCategory).toBe("Food and Drink");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].categoryLabel).toBe("Food and Drink");
    expect(result.totalCap).toBe(600);
    expect(result.totalSpent).toBe(450);
  });

  it("treats generic category scopes from the planner as all-budget questions", async () => {
    getBudgetGoalDataMock.mockResolvedValue(
      budgetData([
        budget({
          categoryPrimary: "FOOD_AND_DRINK",
          categoryLabel: "Food and Drink",
          cap: 600,
          spent: 450,
        }),
        budget({
          categoryPrimary: "TRANSPORTATION",
          categoryLabel: "Transportation",
          cap: 300,
          spent: 120,
        }),
      ])
    );

    const result = await fetchBudgetStatus("tenant-1", { category: "over pace" }, now);

    expect(result.matchedCategory).toBeNull();
    expect(result.rows.map((row) => row.categoryLabel).sort()).toEqual([
      "Food and Drink",
      "Transportation",
    ]);
  });

  it("serializes a missing category with the active budget category list", async () => {
    getBudgetGoalDataMock.mockResolvedValue(
      budgetData([
        budget({
          categoryPrimary: "TRANSPORTATION",
          categoryLabel: "Transportation",
          cap: 300,
          spent: 120,
        }),
      ])
    );

    const result = await fetchBudgetStatus("tenant-1", { category: "Travel" }, now);
    const block = serializeBudgetStatus(result, "CAD");

    expect(result.rows).toHaveLength(0);
    expect(block).toContain("none found");
    expect(block).toContain("Active budget categories: Transportation");
  });
});
