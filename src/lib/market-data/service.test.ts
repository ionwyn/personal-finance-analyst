import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketDataProvider, SecurityProfile } from "./types";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  priceFindMany: vi.fn(),
  priceUpsert: vi.fn(),
  transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketProfile: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
    marketPriceDay: {
      findMany: mocks.priceFindMany,
      upsert: mocks.priceUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

import { MarketDataService } from "./service";

function cachedProfile() {
  const now = new Date();
  return {
    symbol: "AMD",
    provider: "yahoo",
    name: "Advanced Micro Devices, Inc.",
    sector: "Technology",
    industry: "Semiconductors",
    country: "United States",
    description: "Cached profile",
    isFund: false,
    peRatio: 30,
    forwardPe: 20,
    pbRatio: 4,
    evEbitda: 15,
    revenueGrowthPct: 10,
    epsGrowthPct: 12,
    grossMarginPct: 50,
    operatingMarginPct: 20,
    freeCashFlow: 100,
    dividendYieldPct: null,
    expenseRatioPct: null,
    aum: null,
    holdingsCount: null,
    beta: 1.2,
    fetchedAt: now,
    profileFetchedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    fundamentalsFetchedAt: now,
    updatedAt: now,
  };
}

describe("MarketDataService profile cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes a stale profile without refetching fresh fundamentals", async () => {
    const cached = cachedProfile();
    mocks.findUnique.mockResolvedValue(cached);
    mocks.upsert.mockResolvedValue(cached);

    const freshProfile: SecurityProfile = {
      symbol: "AMD",
      name: "AMD",
      sector: "Technology",
      industry: "Semiconductors",
      country: "United States",
      description: "Fresh profile",
      fetchedAt: new Date().toISOString(),
    };
    const provider = {
      getProfile: vi.fn().mockResolvedValue(freshProfile),
      getFundamentals: vi.fn(),
    } as unknown as MarketDataProvider;
    const service = new MarketDataService(provider);

    await expect(service.getProfile("AMD")).resolves.toEqual(freshProfile);
    await expect(service.getFundamentals("AMD")).resolves.toMatchObject({
      symbol: "AMD",
      peRatio: 30,
    });

    expect(provider.getProfile).toHaveBeenCalledOnce();
    expect(provider.getFundamentals).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          description: "Fresh profile",
          profileFetchedAt: expect.any(Date),
        }),
      })
    );
  });
});

describe("MarketDataService historical price cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches missing deep history even when the newest cached row is fresh", async () => {
    const now = new Date();
    mocks.priceFindMany
      .mockResolvedValueOnce([
        {
          date: "2024-12-31",
          close: 20,
          open: null,
          high: null,
          low: null,
          volume: null,
          fetchedAt: now,
        },
      ])
      .mockResolvedValueOnce([
        {
          date: "2020-01-02",
          close: 10,
          open: null,
          high: null,
          low: null,
          volume: null,
          fetchedAt: now,
        },
        {
          date: "2024-12-31",
          close: 20,
          open: null,
          high: null,
          low: null,
          volume: null,
          fetchedAt: now,
        },
      ]);
    mocks.priceUpsert.mockResolvedValue({});

    const provider = {
      getTimeSeriesRange: vi.fn().mockResolvedValue([
        {
          date: "2020-01-02",
          close: 10,
          open: null,
          high: null,
          low: null,
          volume: null,
        },
      ]),
    } as unknown as MarketDataProvider;

    const service = new MarketDataService(provider);
    const result = await service.getTimeSeriesRange("ABC", {
      startDate: "2020-01-01",
      endDate: "2024-12-31",
    });

    expect(provider.getTimeSeriesRange).toHaveBeenCalledOnce();
    expect(result.map((point) => point.date)).toEqual(["2020-01-02", "2024-12-31"]);
  });
});
