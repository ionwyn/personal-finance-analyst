import { describe, expect, it } from "vitest";

import { toYahooSymbol } from "./yahoo";

describe("Yahoo symbol normalization", () => {
  it("preserves ordinary exchange suffixes", () => {
    expect(toYahooSymbol("VFV.TO")).toBe("VFV.TO");
  });

  it("converts US share classes to Yahoo's hyphen form", () => {
    expect(toYahooSymbol("BRK.B")).toBe("BRK-B");
  });

  it("converts share classes before an exchange suffix", () => {
    expect(toYahooSymbol("HPS.A.TO")).toBe("HPS-A.TO");
  });
});
