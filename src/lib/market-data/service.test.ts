import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketDataProvider, SecurityProfile } from "./types";

const mocks = vi.hoisted(() => ({
  quoteFindMany: vi.fn(),
  quoteUpsert: vi.fn(),
  profileFindUnique: vi.fn(),
  profileFindMany: vi.fn(),
  profileUpsert: vi.fn(),
  priceFindMany: vi.fn(),
  executeRaw: vi.fn(async () => 0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketQuote: {
      findMany: mocks.quoteFindMany,
      upsert: mocks.quoteUpsert,
    },
    marketProfile: {
      findUnique: mocks.profileFindUnique,
      findMany: mocks.profileFindMany,
      upsert: mocks.profileUpsert,
    },
    marketPriceDay: {
      findMany: mocks.priceFindMany,
    },
    $executeRaw: mocks.executeRaw,
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
    mocks.profileFindMany.mockResolvedValue([cached]);
    mocks.profileUpsert.mockResolvedValue(cached);

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
    expect(mocks.profileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          description: "Fresh profile",
          profileFetchedAt: expect.any(Date),
        }),
      })
    );
  });
});

describe("MarketDataService quote cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads cached quotes in one query and refreshes only stale or missing symbols", async () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    mocks.quoteFindMany.mockResolvedValue([
      {
        symbol: "AAPL",
        provider: "yahoo",
        currency: "USD",
        price: 200,
        change: 1,
        changePct: 0.5,
        open: null,
        high52w: null,
        low52w: null,
        volume: null,
        marketCap: null,
        prevClose: null,
        dayHigh: null,
        dayLow: null,
        avgVolume: null,
        fetchedAt: now,
        updatedAt: now,
      },
      {
        symbol: "MSFT",
        provider: "yahoo",
        currency: "USD",
        price: 300,
        change: 0,
        changePct: 0,
        open: null,
        high52w: null,
        low52w: null,
        volume: null,
        marketCap: null,
        prevClose: null,
        dayHigh: null,
        dayLow: null,
        avgVolume: null,
        fetchedAt: stale,
        updatedAt: stale,
      },
    ]);
    mocks.quoteUpsert.mockResolvedValue({});

    const provider = {
      getQuote: vi.fn(async (symbol: string) =>
        symbol === "MSFT"
          ? {
              symbol,
              currency: "USD",
              price: 310,
              change: 2,
              changePct: 0.65,
              open: null,
              prevClose: null,
              dayHigh: null,
              dayLow: null,
              high52w: null,
              low52w: null,
              volume: null,
              avgVolume: null,
              marketCap: null,
              fetchedAt: now.toISOString(),
            }
          : null
      ),
    } as unknown as MarketDataProvider;

    const service = new MarketDataService(provider);
    const result = await service.getQuotes(["AAPL", "MSFT", "AAPL", "GOOG"]);

    expect(mocks.quoteFindMany).toHaveBeenCalledOnce();
    expect(provider.getQuote).toHaveBeenCalledTimes(2);
    expect(provider.getQuote).toHaveBeenCalledWith("MSFT");
    expect(provider.getQuote).toHaveBeenCalledWith("GOOG");
    expect(result.map((quote) => quote?.price ?? null)).toEqual([200, 310, 200, null]);
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
    mocks.executeRaw.mockResolvedValue(0);

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
