import { beforeEach, describe, expect, it, vi } from "vitest";

const getInvestmentDashboardDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/investments/analytics", () => ({
  getInvestmentDashboardData: getInvestmentDashboardDataMock,
}));

import {
  fetchInvestmentExposure,
  serializeInvestmentExposure,
} from "@/lib/assistant/investment-exposure";

describe("assistant investment exposure evidence", () => {
  beforeEach(() => {
    getInvestmentDashboardDataMock.mockReset();
  });

  it("aggregates holdings into concentration and allocation evidence", async () => {
    getInvestmentDashboardDataMock.mockResolvedValue({
      summary: {
        portfolioCAD: 10000,
        cashCAD: 500,
        liabilitiesCAD: 0,
        netWorthCAD: 10000,
        positionCount: 4,
        accountCount: 2,
        lastSync: "2026-06-25T00:00:00.000Z",
      },
      holdings: [
        {
          accountId: "a1",
          symbol: "VFV",
          description: "Vanguard S&P 500",
          mvCAD: 4000,
          plPct: 10,
          type: "ETF",
          currency: "CAD",
        },
        {
          accountId: "a2",
          symbol: "VFV",
          description: "Vanguard S&P 500",
          mvCAD: 1000,
          plPct: 8,
          type: "ETF",
          currency: "CAD",
        },
        {
          accountId: "a1",
          symbol: "AAPL",
          description: "Apple",
          mvCAD: 2500,
          plPct: 20,
          type: "Stock",
          currency: "USD",
        },
      ],
      allocByType: [
        { name: "ETF", value: 5000, pct: 66.67 },
        { name: "Stock", value: 2500, pct: 33.33 },
      ],
      allocByCcy: [
        { name: "CAD", value: 5000, pct: 66.67 },
        { name: "USD", value: 2500, pct: 33.33 },
      ],
      sectors: [{ name: "Technology", mvCad: 2500, weightPct: 33.33, pnlCad: 500 }],
      accounts: [
        {
          name: "TFSA",
          institution: "Wealthsimple",
          totalValue: 7000,
          tracked: true,
        },
        {
          name: "RRSP",
          institution: "Wealthsimple",
          totalValue: 3000,
          tracked: true,
        },
      ],
    });

    const result = await fetchInvestmentExposure("tenant-1");

    expect(result.concentration).toEqual({
      top1Pct: 50,
      top3Pct: 75,
      top5Pct: 75,
      top10Pct: 75,
    });
    expect(result.topHoldings[0]).toEqual(
      expect.objectContaining({
        symbol: "VFV",
        value: 5000,
        weightPct: 50,
        plPct: 9.6,
        accountCount: 2,
      })
    );

    const block = serializeInvestmentExposure(result, "CAD");
    expect(block).toContain("INVESTMENT EXPOSURE STATUS");
    expect(block).toContain("descriptive only, not investment advice");
    expect(block).toContain("top 1 50%");
    expect(block).toContain("VFV");
    expect(block).toContain("SECTOR EXPOSURE");
  });
});
