import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  plaidTransaction: { findMany: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({
  getTransactionsForTenant: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { getTransactionsForTenant } from "@/lib/analytics";
import {
  fetchPeriodComparison,
  fetchTopAggregates,
  fetchScopedTransactions,
  filtersSchema,
  MAX_ROWS,
  planSchema,
  resolveComparisonWindow,
  resolvePeriod,
  serializeAggregateRows,
  serializePeriodComparison,
  serializeRows,
} from "@/lib/assistant/query";

const mockGet = vi.mocked(getTransactionsForTenant);

function fakeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    name: `Merchant ${i}`,
    rawName: `RAW ${i}`,
    account: "Checking",
    accountId: "a1",
    date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    authorizedDate: undefined,
    amount: i + 1,
    category: "Shops",
    categoryColor: "var(--cat-1)",
    detailedCategory: null,
    pending: false,
    bucket: "spending" as const,
  }));
}

describe("assistant plan schema", () => {
  it("accepts a valid summary-only plan", () => {
    expect(planSchema.parse({ intent: "summary" }).intent).toBe("summary");
  });

  it("accepts valid filters", () => {
    const p = planSchema.parse({
      intent: "transaction_list",
      filters: { q: "amazon", from: "2026-05-01", bucket: "spending", amountMin: 50 },
    });
    expect(p.filters?.q).toBe("amazon");
  });

  it("normalizes the old boolean plan shape", () => {
    expect(planSchema.parse({ needsTransactions: false }).intent).toBe("summary");
    expect(planSchema.parse({ needsTransactions: true }).intent).toBe("transaction_list");
  });

  it("rejects an unknown intent", () => {
    expect(planSchema.safeParse({ intent: "investment_advice" }).success).toBe(false);
  });

  it("keeps a valid intent when the planner invents an invalid filter value", () => {
    const parsed = planSchema.parse({
      intent: "budget_status",
      filters: { bucket: "burn_rate", category: "Food and Drink" },
    });

    expect(parsed).toEqual({
      intent: "budget_status",
      filters: { bucket: undefined, category: "Food and Drink" },
    });
  });

  it("accepts pay-cycle status plans", () => {
    expect(planSchema.parse({ intent: "cycle_status" })).toEqual({ intent: "cycle_status" });
  });

  it("strips unknown filter fields rather than passing them through", () => {
    const parsed = filtersSchema.parse({ q: "amazon", accountId: "secret", removed: false });
    expect(parsed).toEqual({ q: "amazon" });
    expect("accountId" in parsed).toBe(false);
  });

  it("rejects malformed dates and invalid bucket", () => {
    expect(filtersSchema.safeParse({ from: "May 1st" }).success).toBe(false);
    expect(filtersSchema.safeParse({ bucket: "transfers" }).success).toBe(false);
  });

  it("accepts a known period and rejects an unknown one", () => {
    expect(filtersSchema.parse({ period: "last_month" }).period).toBe("last_month");
    expect(filtersSchema.safeParse({ period: "since_forever" }).success).toBe(false);
  });
});

describe("resolvePeriod", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  it("maps last_month to the previous calendar month, excluding earlier months", () => {
    // The reported bug: a March transaction must NOT fall inside "last month" of May.
    expect(resolvePeriod("last_month", now)).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("maps this_month from the first of the month to now", () => {
    expect(resolvePeriod("this_month", now)).toEqual({ from: "2026-05-01", to: "2026-05-31" });
  });

  it("maps rolling windows relative to now", () => {
    expect(resolvePeriod("last_30_days", now)).toEqual({ from: "2026-05-01", to: "2026-05-31" });
    expect(resolvePeriod("this_year", now)).toEqual({ from: "2026-01-01", to: "2026-05-31" });
  });

  it("leaves all_time unbounded", () => {
    expect(resolvePeriod("all_time", now)).toEqual({});
  });
});

describe("resolveComparisonWindow", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  it("compares this month to the same dates last month", () => {
    expect(resolveComparisonWindow({ period: "this_month" }, now)).toEqual({
      current: { label: "current month to date", from: "2026-06-01", to: "2026-06-18" },
      previous: { label: "same period last month", from: "2026-05-01", to: "2026-05-18" },
    });
  });

  it("compares last month to the month before last", () => {
    expect(resolveComparisonWindow({ period: "last_month" }, now)).toEqual({
      current: { label: "last month", from: "2026-05-01", to: "2026-05-31" },
      previous: { label: "month before last", from: "2026-04-01", to: "2026-04-30" },
    });
  });

  it("compares explicit ranges to the immediately preceding equal-length range", () => {
    expect(resolveComparisonWindow({ from: "2026-06-10", to: "2026-06-18" }, now)).toEqual({
      current: { label: "this month", from: "2026-06-10", to: "2026-06-18" },
      previous: { label: "previous comparable period", from: "2026-06-01", to: "2026-06-09" },
    });
  });
});

describe("fetchScopedTransactions", () => {
  beforeEach(() => {
    mockGet.mockReset();
    prismaMock.tenant.findUnique.mockReset();
    prismaMock.plaidTransaction.findMany.mockReset();
  });

  it("hard-caps rows at MAX_ROWS and projects to a minimal shape", async () => {
    mockGet.mockResolvedValue({ rows: fakeRows(120), total: 120 } as never);

    const result = await fetchScopedTransactions("personal", { bucket: "spending" });

    expect(result.rows).toHaveLength(MAX_ROWS);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(120);
    // Only the four allowed fields are exposed.
    expect(Object.keys(result.rows[0]).sort()).toEqual(["amount", "category", "date", "name"]);
    // Dates are trimmed to YYYY-MM-DD.
    expect(result.rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("maps numeric amount bounds to the underlying string API", async () => {
    mockGet.mockResolvedValue({ rows: fakeRows(2), total: 2 } as never);

    await fetchScopedTransactions("personal", { amountMin: 50, amountMax: 200 });

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({ amountMin: "50", amountMax: "200", tenantSlug: "personal" })
    );
  });

  it("resolves a named period into the date window passed to the query", async () => {
    mockGet.mockResolvedValue({ rows: fakeRows(1), total: 1 } as never);

    await fetchScopedTransactions(
      "personal",
      { period: "last_month", amountMin: 200 },
      new Date("2026-05-31T12:00:00.000Z")
    );

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-04-01", to: "2026-04-30", amountMin: "200" })
    );
  });

  it("lets an explicit from/to override the period", async () => {
    mockGet.mockResolvedValue({ rows: fakeRows(1), total: 1 } as never);

    await fetchScopedTransactions(
      "personal",
      { period: "last_month", from: "2026-03-01", to: "2026-03-15" },
      new Date("2026-05-31T12:00:00.000Z")
    );

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-03-01", to: "2026-03-15" })
    );
  });

  it("counts and sums only the rows that passed every filter, not the DB total", async () => {
    // getTransactionsForTenant applies amount/bucket filters in memory; its `total`
    // is a pre-filter DB count and must not leak into the assistant's reported count.
    mockGet.mockResolvedValue({
      rows: [
        { ...fakeRows(1)[0], amount: 642.65 },
        { ...fakeRows(1)[0], amount: 250 },
      ],
      total: 347,
    } as never);

    const result = await fetchScopedTransactions("personal", { amountMin: 200 });

    expect(result.total).toBe(2);
    expect(result.sumAmount).toBe(892.65);
    expect(serializeRows(result)).not.toContain("347");
  });

  it("drops blank string filters the model sometimes emits", async () => {
    mockGet.mockResolvedValue({ rows: fakeRows(1), total: 1 } as never);

    await fetchScopedTransactions("personal", { q: "  ", from: "" });

    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined, from: undefined })
    );
  });

  it("reports no matches cleanly", () => {
    expect(
      serializeRows({ rows: [], total: 0, truncated: false, sumAmount: 0, resolvedCategory: null })
    ).toContain("none found");
  });
});

describe("fetchTopAggregates", () => {
  beforeEach(() => {
    mockGet.mockReset();
    prismaMock.tenant.findUnique.mockReset();
    prismaMock.plaidTransaction.findMany.mockReset();
  });

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

  it("computes and sorts top merchant totals for a custom date range", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    prismaMock.plaidTransaction.findMany.mockResolvedValue([
      dbTxn({ merchant: "Marche Barcelo Inc.", amount: 879.49 }),
      dbTxn({ merchant: "Amazon", amount: 200 }),
      dbTxn({ merchant: "Amazon", amount: 437.49, date: "2026-06-16" }),
      dbTxn({ merchant: "Uber Eats", amount: 285.5 }),
      dbTxn({ merchant: "Gpcanadaca Mta", amount: 270 }),
      dbTxn({ merchant: "Intermarche Beaubien", amount: 294.2 }),
    ]);

    const result = await fetchTopAggregates(
      "personal",
      { from: "2026-06-01", to: "2026-06-18", bucket: "spending" },
      "merchant",
      5,
      new Date("2026-06-18T12:00:00.000Z")
    );

    expect(prismaMock.plaidTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          date: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-18T23:59:59.999Z"),
          },
        }),
      })
    );
    expect(result.rows.map((row) => [row.label, row.amount, row.count])).toEqual([
      ["Marche Barcelo Inc.", 879.49, 1],
      ["Amazon", 637.49, 2],
      ["Intermarche Beaubien", 294.2, 1],
      ["Uber Eats", 285.5, 1],
      ["Gpcanadaca Mta", 270, 1],
    ]);
    expect(result.sumAmount).toBe(2366.68);
  });

  it("serializes aggregate evidence with supporting source rows", () => {
    const block = serializeAggregateRows(
      {
        kind: "merchant",
        rows: [
          {
            label: "Marche Barcelo Inc.",
            amount: 879.49,
            count: 1,
            rows: [
              {
                date: "2026-06-15",
                name: "Marche Barcelo Inc.",
                amount: 879.49,
                category: "Food and Drink",
              },
            ],
          },
        ],
        totalGroups: 1,
        totalTransactions: 1,
        sumAmount: 879.49,
        resolvedCategory: null,
        truncated: false,
      },
      "CAD"
    );

    expect(block).toContain("TOP MERCHANTS");
    expect(block).toContain("server-computed totals");
    expect(block).toContain("source row: 2026-06-15 | Marche Barcelo Inc.");
  });
});

describe("fetchPeriodComparison", () => {
  beforeEach(() => {
    mockGet.mockReset();
    prismaMock.tenant.findUnique.mockReset();
    prismaMock.plaidTransaction.findMany.mockReset();
  });

  function dbTxn(input: { merchant: string; amount: number; date: string; category?: string }) {
    return {
      name: input.merchant.toUpperCase(),
      merchantName: input.merchant,
      amount: input.amount,
      date: new Date(`${input.date}T12:00:00.000Z`),
      categoryPrimary: input.category ?? "SHOPS",
      categoryDetailed: null,
      txnType: "expense",
      removed: false,
      supersededById: null,
      account: { tracked: true },
    };
  }

  it("computes totals, deltas, and drivers for a month-to-date comparison", async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ id: "tenant-1" });
    prismaMock.plaidTransaction.findMany
      .mockResolvedValueOnce([
        dbTxn({ merchant: "Amazon", amount: 500, date: "2026-06-12" }),
        dbTxn({ merchant: "Grocery", amount: 100, date: "2026-06-13", category: "FOOD_AND_DRINK" }),
      ])
      .mockResolvedValueOnce([
        dbTxn({ merchant: "Amazon", amount: 200, date: "2026-05-12" }),
        dbTxn({ merchant: "Grocery", amount: 150, date: "2026-05-13", category: "FOOD_AND_DRINK" }),
      ]);

    const result = await fetchPeriodComparison(
      "personal",
      { period: "this_month", bucket: "spending" },
      new Date("2026-06-18T12:00:00.000Z")
    );

    const calls = prismaMock.plaidTransaction.findMany.mock.calls;
    expect(calls[0][0].where.date).toEqual({
      gte: new Date("2026-06-01T00:00:00.000Z"),
      lte: new Date("2026-06-18T23:59:59.999Z"),
    });
    expect(calls[1][0].where.date).toEqual({
      gte: new Date("2026-05-01T00:00:00.000Z"),
      lte: new Date("2026-05-18T23:59:59.999Z"),
    });
    expect(result.current.amount).toBe(600);
    expect(result.previous.amount).toBe(350);
    expect(result.deltaAmount).toBe(250);
    expect(result.deltaPct).toBe(71.43);
    expect(result.deltaAvgAmount).toBe(125);
    expect(result.merchantDrivers[0]).toEqual(
      expect.objectContaining({ label: "Amazon", deltaAmount: 300 })
    );
    expect(result.categoryDrivers[0]).toEqual(
      expect.objectContaining({ label: "Shops", deltaAmount: 300 })
    );

    const block = serializePeriodComparison(result, "CAD");
    expect(block).toContain("PERIOD COMPARISON");
    expect(block).toContain("MERCHANT DRIVERS");
    expect(block).toContain("CATEGORY DRIVERS");
    expect(block).toContain("Change: +CAD 250");
  });
});
