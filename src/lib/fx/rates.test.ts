import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FxRecord = {
  pair: string;
  rate: { toNumber(): number };
  fetchedAt: Date;
};

function decimalLike(value: unknown) {
  const number = Number(
    typeof value === "object" && value && "toString" in value ? value.toString() : value
  );
  return { toNumber: () => number };
}

describe("Twelve Data FX cache", () => {
  const records = new Map<string, FxRecord>();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    records.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TWELVEDATA_API_KEY", "test-key");

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        fxRate: {
          findUnique: vi.fn(
            async ({ where }: { where: { pair: string } }) => records.get(where.pair) ?? null
          ),
          upsert: vi.fn(
            async ({
              where,
              create,
              update,
            }: {
              where: { pair: string };
              create?: { rate?: unknown; fetchedAt?: Date };
              update?: { rate?: unknown; fetchedAt?: Date };
            }) => {
              const record = {
                pair: where.pair,
                rate: decimalLike(create?.rate ?? update?.rate),
                fetchedAt: create?.fetchedAt ?? update?.fetchedAt ?? new Date(),
              };
              records.set(where.pair, record);
              return record;
            }
          ),
        },
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/prisma");
  });

  function okRate(rate: number) {
    return { ok: true, json: async () => ({ symbol: "X", rate }) };
  }

  it("fetches and caches direct currency pairs", async () => {
    fetchMock.mockResolvedValueOnce(okRate(1.37));
    const { getFxRate } = await import("@/lib/fx/rates");

    await expect(getFxRate("usd", "cad")).resolves.toBe(1.37);
    await expect(getFxRate("USD", "CAD")).resolves.toBe(1.37);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(records.get("USD-CAD")?.rate.toNumber()).toBe(1.37);
  });

  it("returns 1 for identical currencies without fetching", async () => {
    const { getFxRate } = await import("@/lib/fx/rates");
    await expect(getFxRate("CAD", "CAD")).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tries the inverse pair and stores the inverted rate", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "error", message: "no pair" }),
      })
      .mockResolvedValueOnce(okRate(0.75));
    const { getFxRate } = await import("@/lib/fx/rates");

    await expect(getFxRate("USD", "CAD")).resolves.toBeCloseTo(1.333333, 5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unsupported currencies", async () => {
    const { getFxRate } = await import("@/lib/fx/rates");
    await expect(getFxRate("EUR", "CAD")).rejects.toThrow("Unsupported FX pair");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
