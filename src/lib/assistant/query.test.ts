import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({
  getTransactionsForTenant: vi.fn(),
}));

import { getTransactionsForTenant } from "@/lib/analytics";
import {
  fetchScopedTransactions,
  filtersSchema,
  MAX_ROWS,
  planSchema,
  resolvePeriod,
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

describe("fetchScopedTransactions", () => {
  beforeEach(() => mockGet.mockReset());

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
