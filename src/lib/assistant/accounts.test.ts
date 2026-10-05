import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  plaidAccount: { findMany: vi.fn() },
  plaidTransaction: { findMany: vi.fn() },
}));
const loadInvestmentsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/investments/loader", () => ({
  loadInvestments: loadInvestmentsMock,
}));

import { fetchAccountStatus, serializeAccountStatus } from "@/lib/assistant/accounts";

function dec(value: number) {
  return new Prisma.Decimal(value);
}

describe("assistant account status evidence", () => {
  const now = new Date("2026-06-25T12:00:00.000Z");

  beforeEach(() => {
    prismaMock.plaidAccount.findMany.mockReset();
    prismaMock.plaidTransaction.findMany.mockReset();
    loadInvestmentsMock.mockReset();
  });

  it("summarizes Plaid account balances and period spending", async () => {
    prismaMock.plaidAccount.findMany.mockResolvedValue([
      {
        id: "acct-1",
        name: "Chequing",
        officialName: "Everyday Chequing",
        type: "depository",
        subtype: "checking",
        isoCurrencyCode: "CAD",
        unofficialCurrencyCode: null,
        currentBalance: dec(1500),
        availableBalance: dec(1400),
        tracked: true,
      },
      {
        id: "acct-2",
        name: "Credit Card",
        officialName: null,
        type: "credit",
        subtype: "credit card",
        isoCurrencyCode: "CAD",
        unofficialCurrencyCode: null,
        currentBalance: dec(300),
        availableBalance: dec(4700),
        tracked: true,
      },
    ]);
    prismaMock.plaidTransaction.findMany.mockResolvedValue([
      {
        accountId: "acct-1",
        amount: dec(25),
        txnType: "expense",
        categoryPrimary: "FOOD_AND_DRINK",
        categoryDetailed: null,
        removed: false,
        supersededById: null,
      },
      {
        accountId: "acct-1",
        amount: dec(-2500),
        txnType: "income",
        categoryPrimary: "INCOME",
        categoryDetailed: null,
        removed: false,
        supersededById: null,
      },
    ]);
    loadInvestmentsMock.mockResolvedValue({
      accounts: [
        {
          name: "TFSA",
          institution: "Wealthsimple",
          registration: "TFSA",
          kind: "REGISTERED",
          currency: "CAD",
          tracked: true,
          totalValue: 10000,
          cash: 500,
          liabilityCAD: 0,
          positionCount: 4,
          lastSyncAt: "2026-06-25T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchAccountStatus({
      tenantId: "tenant-1",
      filters: { q: "chequing", period: "this_month" },
      now,
    });

    expect(result.scope).toBe("chequing");
    expect(result.period).toEqual({ from: "2026-06-01", to: "2026-06-25", label: "this month" });
    expect(result.plaid.count).toBe(1);
    expect(result.plaid.totalSpend).toBe(25);
    expect(result.plaid.totalIncome).toBe(2500);
    expect(result.investments.count).toBe(0);

    const block = serializeAccountStatus(result, "CAD");
    expect(block).toContain("ACCOUNT STATUS");
    expect(block).toContain("Chequing");
    expect(block).toContain("period spend CAD 25");
    expect(block).toContain("period income CAD 2,500");
  });

  it("includes investment accounts when scoped by registration", async () => {
    prismaMock.plaidAccount.findMany.mockResolvedValue([]);
    prismaMock.plaidTransaction.findMany.mockResolvedValue([]);
    loadInvestmentsMock.mockResolvedValue({
      accounts: [
        {
          name: "TFSA",
          institution: "Wealthsimple",
          registration: "TFSA",
          kind: "REGISTERED",
          currency: "CAD",
          tracked: true,
          totalValue: 10000,
          cash: 500,
          liabilityCAD: 0,
          positionCount: 4,
          lastSyncAt: "2026-06-25T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchAccountStatus({ tenantId: "tenant-1", filters: { q: "TFSA" }, now });

    expect(result.investments.count).toBe(1);
    expect(result.investments.totalValue).toBe(10000);
    expect(serializeAccountStatus(result, "CAD")).toContain("INVESTMENT ACCOUNTS");
  });
});
