import { describe, expect, it } from "vitest";

import { PORTFOLIO_SECURITIES, resolvePortfolioSecurity } from "./portfolio-symbols";

describe("portfolio symbol registry", () => {
  it("contains all 49 lifetime ledger symbols exactly once", () => {
    expect(PORTFOLIO_SECURITIES).toHaveLength(49);
    expect(new Set(PORTFOLIO_SECURITIES.map((security) => security.ledgerSymbol)).size).toBe(49);
  });

  it("uses the verified historical exchange mappings", () => {
    expect(resolvePortfolioSecurity("ABR")).toEqual({
      ledgerSymbol: "ABR",
      marketSymbol: "ABR.V",
      currency: "CAD",
    });
    expect(resolvePortfolioSecurity("QTIP")).toEqual({
      ledgerSymbol: "QTIP",
      marketSymbol: "QTIP.NE",
      currency: "CAD",
    });
    expect(resolvePortfolioSecurity("VSEC")).toEqual({
      ledgerSymbol: "VSEC",
      marketSymbol: "VSEC",
      currency: "USD",
    });
    expect(resolvePortfolioSecurity("EQB500")).toBeNull();
  });
});
