import { beforeEach, describe, expect, it, vi } from "vitest";

describe("SnapTrade logo handling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        snapTradeSecurityLogo: {
          upsert: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
        },
      },
    }));
  });

  it("allows only HTTPS Twelve Data logo hosts", async () => {
    const { normalizeSnapTradeLogoUrl } = await import("@/lib/snaptrade/logo");
    expect(normalizeSnapTradeLogoUrl("https://api.twelvedata.com/logo/apple.com")).toBe(
      "https://api.twelvedata.com/logo/apple.com"
    );
    expect(normalizeSnapTradeLogoUrl("https://logo.twelvedata.com/symbols/fb-meta.jpg")).toBe(
      "https://logo.twelvedata.com/symbols/fb-meta.jpg"
    );
    expect(normalizeSnapTradeLogoUrl("http://api.twelvedata.com/logo/apple.com")).toBeNull();
    expect(normalizeSnapTradeLogoUrl("https://example.com/logo.png")).toBeNull();
  });

  it("hashes logo URLs deterministically", async () => {
    const { logoIdForUrl } = await import("@/lib/snaptrade/logo");
    const url = "https://api.twelvedata.com/logo/apple.com";
    expect(logoIdForUrl(url)).toBe(logoIdForUrl(url));
    expect(logoIdForUrl(url)).toHaveLength(64);
  });
});
