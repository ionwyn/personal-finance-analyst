import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  recurringExpense: { findMany: vi.fn() },
  plaidRecurringStream: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { fetchRecurringSpendStatus, serializeRecurringSpendStatus } from "@/lib/assistant/recurring";

function dec(value: number) {
  return new Prisma.Decimal(value);
}

describe("assistant recurring spend evidence", () => {
  beforeEach(() => {
    prismaMock.recurringExpense.findMany.mockReset();
    prismaMock.plaidRecurringStream.findMany.mockReset();
  });

  it("summarizes confirmed expenses and cached Plaid recurring streams", async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([
      {
        name: "Netflix",
        merchantPattern: "NETFLIX",
        amount: dec(30),
        frequency: "monthly",
        anchorDate: 22,
        accrualPerCycle: dec(15),
      },
      {
        name: "Gym",
        merchantPattern: null,
        amount: dec(20),
        frequency: "weekly",
        anchorDate: 5,
        accrualPerCycle: dec(40),
      },
    ]);
    prismaMock.plaidRecurringStream.findMany.mockResolvedValue([
      {
        direction: "outflow",
        merchantName: "Spotify",
        description: null,
        frequencyRaw: "MONTHLY",
        frequency: "monthly",
        averageAmount: dec(12),
        lastAmount: dec(12),
        lastDate: new Date("2026-06-01T00:00:00.000Z"),
        predictedNextDate: new Date("2026-07-01T00:00:00.000Z"),
        status: "MATURE",
        isUserModified: false,
      },
      {
        direction: "inflow",
        merchantName: "Employer Payroll",
        description: null,
        frequencyRaw: "BIWEEKLY",
        frequency: "biweekly",
        averageAmount: dec(2500),
        lastAmount: dec(2500),
        lastDate: new Date("2026-06-14T00:00:00.000Z"),
        predictedNextDate: new Date("2026-06-28T00:00:00.000Z"),
        status: "MATURE",
        isUserModified: false,
      },
    ]);

    const result = await fetchRecurringSpendStatus("tenant-1");

    expect(result.confirmed.count).toBe(2);
    expect(result.confirmed.totalMonthlyEquivalent).toBe(116.67);
    expect(result.confirmed.totalAccrualPerCycle).toBe(55);
    expect(result.confirmed.rows[0]).toEqual(
      expect.objectContaining({ name: "Gym", monthlyEquivalent: 86.67 })
    );
    expect(result.detectedOutflows.totalMonthlyEquivalent).toBe(12);
    expect(result.detectedInflows.count).toBe(1);

    const block = serializeRecurringSpendStatus(result, "CAD");
    expect(block).toContain("RECURRING SPEND STATUS");
    expect(block).toContain("Confirmed recurring expenses: 2");
    expect(block).toContain("Gym");
    expect(block).toContain("Spotify");
    expect(block).toContain("Employer Payroll");
  });

  it("filters recurring rows by merchant scope", async () => {
    prismaMock.recurringExpense.findMany.mockResolvedValue([
      {
        name: "Netflix",
        merchantPattern: "NETFLIX",
        amount: dec(30),
        frequency: "monthly",
        anchorDate: 22,
        accrualPerCycle: dec(15),
      },
      {
        name: "Gym",
        merchantPattern: null,
        amount: dec(20),
        frequency: "weekly",
        anchorDate: 5,
        accrualPerCycle: dec(40),
      },
    ]);
    prismaMock.plaidRecurringStream.findMany.mockResolvedValue([]);

    const result = await fetchRecurringSpendStatus("tenant-1", { q: "netflix" });

    expect(result.scope).toBe("netflix");
    expect(result.confirmed.rows.map((row) => row.name)).toEqual(["Netflix"]);
    expect(serializeRecurringSpendStatus(result, "CAD")).toContain('matching "netflix"');
  });
});
