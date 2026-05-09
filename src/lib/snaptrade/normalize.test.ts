import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "snaptrade-typescript-sdk";

describe("SnapTrade normalization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        snapTradeSecurityLogo: {
          upsert: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn()
        }
      }
    }));
  });

  it("maps v1 positions and keeps allowed logo URLs", async () => {
    const { normalizePosition } = await import("@/lib/snaptrade/normalize");
    const normalized = normalizePosition({
      symbol: {
        symbol: {
          id: "sym_1",
          symbol: "AAPL",
          raw_symbol: "AAPL",
          description: "Apple Inc.",
          currency: { code: "USD" },
          exchange: { code: "NASDAQ", mic_code: "XNAS" },
          type: { code: "cs", description: "Common Stock" },
          logo_url: "https://api.twelvedata.com/logo/apple.com"
        }
      },
      units: 2,
      price: 200,
      average_purchase_price: 150,
      currency: { code: "USD" },
      cash_equivalent: false,
      tax_lots: [{ ignored: true }]
    } as unknown as Position);

    expect(normalized).toMatchObject({
      symbol: "AAPL",
      assetType: "Stock",
      exchange: "XNAS",
      currency: "USD",
      marketValueNative: 400,
      costNative: 300,
      pnlNative: 100,
      logoUrl: "https://api.twelvedata.com/logo/apple.com"
    });
  });

  it("handles missing cost basis without manufacturing P&L", async () => {
    const { normalizePosition } = await import("@/lib/snaptrade/normalize");
    const normalized = normalizePosition({
      symbol: {
        symbol: {
          id: "sym_2",
          symbol: "VAB.TO",
          raw_symbol: "VAB",
          description: "Vanguard Canadian Aggregate Bond Index ETF",
          currency: { code: "CAD" },
          exchange: { code: "TSX" },
          type: { code: "et", description: "ETF" },
          logo_url: "https://example.com/logo.png"
        }
      },
      units: 10,
      price: 25,
      average_purchase_price: null,
      currency: { code: "CAD" }
    } as unknown as Position);

    expect(normalized?.assetType).toBe("ETF");
    expect(normalized?.costNative).toBeNull();
    expect(normalized?.pnlNative).toBeNull();
    expect(normalized?.pnlPct).toBeNull();
    expect(normalized?.logoUrl).toBeNull();
  });
});
