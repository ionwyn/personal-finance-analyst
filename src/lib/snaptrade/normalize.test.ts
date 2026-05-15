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

  it("accepts logo URLs from alternate SnapTrade position shapes", async () => {
    const { normalizePosition } = await import("@/lib/snaptrade/normalize");

    const wrapperLogo = normalizePosition({
      symbol: {
        symbol: {
          id: "sym_3",
          symbol: "VTI",
          raw_symbol: "VTI",
          description: "Vanguard Total Stock Market ETF",
          currency: { code: "USD" },
          type: { code: "et", description: "ETF" }
        },
        logo_url: "https://api.twelvedata.com/logo/vanguard.com"
      },
      units: 1,
      price: 250,
      currency: { code: "USD" }
    } as unknown as Position);

    const topLevelLogo = normalizePosition({
      symbol: {
        symbol: {
          id: "sym_4",
          symbol: "GLDM",
          raw_symbol: "GLDM",
          description: "SPDR Gold MiniShares Trust",
          currency: { code: "USD" },
          type: { code: "et", description: "ETF" }
        }
      },
      logo_url: "https://api.twelvedata.com/logo/spdr.com",
      units: 1,
      price: 50,
      currency: { code: "USD" }
    } as unknown as Position);

    expect(wrapperLogo?.logoUrl).toBe("https://api.twelvedata.com/logo/vanguard.com");
    expect(topLevelLogo?.logoUrl).toBe("https://api.twelvedata.com/logo/spdr.com");
  });

  it("identifies closed account statuses before per-account sync", async () => {
    const { isClosedSnapTradeAccountStatus } = await import("@/lib/snaptrade/normalize");

    expect(isClosedSnapTradeAccountStatus("closed")).toBe(true);
    expect(isClosedSnapTradeAccountStatus("CLOSED")).toBe(true);
    expect(isClosedSnapTradeAccountStatus("account-closed")).toBe(true);
    expect(isClosedSnapTradeAccountStatus("open")).toBe(false);
    expect(isClosedSnapTradeAccountStatus(null)).toBe(false);
  });
});
