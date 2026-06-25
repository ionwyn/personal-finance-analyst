import { beforeEach, describe, expect, it, vi } from "vitest";

const getBudgetGoalDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/budgets/getBudgetGoalData", () => ({
  getBudgetGoalData: getBudgetGoalDataMock,
}));

import { fetchSavingsGoalStatus, serializeSavingsGoalStatus } from "@/lib/assistant/savings";

function goal(input: {
  name: string;
  target: number;
  saved: number;
  targetDate?: string | null;
  destinationLabel?: string | null;
  tracked?: boolean;
}) {
  return {
    id: input.name,
    name: input.name,
    target: input.target,
    saved: input.saved,
    remaining: Math.max(0, input.target - input.saved),
    pct: input.target > 0 ? Math.min(100, (input.saved / input.target) * 100) : 0,
    reached: input.saved >= input.target,
    color: "var(--cat-1)",
    startDate: null,
    targetDate: input.targetDate ?? null,
    savingsDestinationId: input.destinationLabel ? "dest-1" : null,
    destinationLabel: input.destinationLabel ?? null,
    manualAmount: input.tracked === false ? input.saved : 0,
    tracked: input.tracked ?? true,
  };
}

describe("assistant savings goal evidence", () => {
  const now = new Date("2026-06-25T12:00:00.000Z");

  beforeEach(() => {
    getBudgetGoalDataMock.mockReset();
  });

  it("serializes savings-goal progress and pace fields", async () => {
    getBudgetGoalDataMock.mockResolvedValue({
      goals: [
        goal({
          name: "Vacation",
          target: 2000,
          saved: 800,
          targetDate: "2026-08-24T00:00:00.000Z",
          destinationLabel: "Vacation Savings",
        }),
        goal({ name: "Emergency Fund", target: 5000, saved: 5000, tracked: false }),
      ],
    });

    const result = await fetchSavingsGoalStatus("tenant-1", {}, now);

    expect(result.totalGoals).toBe(2);
    expect(result.totalTarget).toBe(7000);
    expect(result.totalSaved).toBe(5800);
    expect(result.reachedCount).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        name: "Vacation",
        remaining: 1200,
        pct: 40,
        daysUntilTarget: 60,
        paceNeededMonthly: 608.75,
      })
    );

    const block = serializeSavingsGoalStatus(result, "CAD");
    expect(block).toContain("SAVINGS GOAL STATUS");
    expect(block).toContain("Vacation");
    expect(block).toContain("remaining CAD 1,200");
    expect(block).toContain("tracking destination transactions");
    expect(block).toContain("Emergency Fund");
  });

  it("filters goals by named scope", async () => {
    getBudgetGoalDataMock.mockResolvedValue({
      goals: [
        goal({ name: "Vacation", target: 2000, saved: 800 }),
        goal({ name: "Emergency Fund", target: 5000, saved: 1200 }),
      ],
    });

    const result = await fetchSavingsGoalStatus("tenant-1", { q: "emergency" }, now);

    expect(result.scope).toBe("emergency");
    expect(result.rows.map((row) => row.name)).toEqual(["Emergency Fund"]);
    expect(serializeSavingsGoalStatus(result, "CAD")).toContain('matching "emergency"');
  });
});
