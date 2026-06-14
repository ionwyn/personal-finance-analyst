import { describe, expect, it } from "vitest";

import { toYahooSymbol } from "./yahoo";

describe("toYahooSymbol", () => {
  it("distinguishes share classes from Canadian exchange suffixes", () => {
    expect(toYahooSymbol("BRK.B")).toBe("BRK-B");
    expect(toYahooSymbol("HPS.A.TO")).toBe("HPS-A.TO");
    expect(toYahooSymbol("ABR.V")).toBe("ABR.V");
    expect(toYahooSymbol("QTIP.NE")).toBe("QTIP.NE");
    expect(toYahooSymbol("VFV.TO")).toBe("VFV.TO");
  });
});
