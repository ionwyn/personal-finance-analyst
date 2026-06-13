import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketDataProvider, SecurityProfile } from "./types";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketProfile: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
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
