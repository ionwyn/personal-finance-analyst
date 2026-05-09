import { beforeEach, describe, expect, it, vi } from "vitest";

type FxRecord = {
  pair: string;
  rate: { toNumber(): number };
  fetchedAt: Date;
};

function decimalLike(value: unknown) {
  const number = Number(
    typeof value === "object" && value && "toString" in value
      ? value.toString()
      : value
  );
  return { toNumber: () => number };
}

describe("SnapTrade FX cache", () => {
  const records = new Map<string, FxRecord>();
  const getCurrencyExchangeRatePair = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    records.clear();
    getCurrencyExchangeRatePair.mockReset();

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        snapTradeFxRate: {
          findUnique: vi.fn(async ({ where }: { where: { pair: string } }) => records.get(where.pair) ?? null),
          upsert: vi.fn(async ({
            where,
            create,
            update
          }: {
            where: { pair: string };
            create?: { rate?: unknown; fetchedAt?: Date };
            update?: { rate?: unknown; fetchedAt?: Date };
          }) => {
            const rate = decimalLike(create?.rate ?? update?.rate);
            const record = {
              pair: where.pair,
              rate,
              fetchedAt: create?.fetchedAt ?? update?.fetchedAt ?? new Date()
            };
            records.set(where.pair, record);
            return record;
          })
        }
      }
    }));

    vi.doMock("@/lib/snaptrade/client", () => ({
      getSnapTradeClient: () => ({
        referenceData: { getCurrencyExchangeRatePair }
      })
    }));
  });

  it("fetches and caches direct currency pairs", async () => {
    getCurrencyExchangeRatePair.mockResolvedValueOnce({
      data: { exchange_rate: 1.37 }
    });
    const { getFxRate } = await import("@/lib/snaptrade/fx");

    await expect(getFxRate("usd", "cad")).resolves.toBe(1.37);
    await expect(getFxRate("USD", "CAD")).resolves.toBe(1.37);
    expect(getCurrencyExchangeRatePair).toHaveBeenCalledTimes(1);
    expect(records.get("USD-CAD")?.rate.toNumber()).toBe(1.37);
  });

  it("tries inverse pairs and stores the inverted rate", async () => {
    getCurrencyExchangeRatePair
      .mockRejectedValueOnce(new Error("missing direct pair"))
      .mockResolvedValueOnce({ data: { exchange_rate: 0.75 } });
    const { getFxRate } = await import("@/lib/snaptrade/fx");

    await expect(getFxRate("USD", "CAD")).resolves.toBeCloseTo(1.333333, 5);
    expect(getCurrencyExchangeRatePair).toHaveBeenNthCalledWith(1, {
      currencyPair: "USD-CAD"
    });
    expect(getCurrencyExchangeRatePair).toHaveBeenNthCalledWith(2, {
      currencyPair: "CAD-USD"
    });
  });

  it("fails when no current or cached rate exists", async () => {
    getCurrencyExchangeRatePair.mockRejectedValue(new Error("missing pair"));
    const { getFxRate } = await import("@/lib/snaptrade/fx");

    await expect(getFxRate("EUR", "CAD")).rejects.toThrow("Missing FX rate EUR-CAD");
  });
});
