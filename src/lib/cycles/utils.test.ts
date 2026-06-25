import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "@/lib/cycles/utils";

describe("normalizeMerchant", () => {
  it("uppercases and trims", () => {
    expect(normalizeMerchant("  Spotify   ")).toBe("SPOTIFY");
  });

  it("strips trailing # store numbers", () => {
    expect(normalizeMerchant("Tim Hortons #4421")).toBe("TIM HORTONS");
  });

  it("drops standalone multi-digit tokens", () => {
    expect(normalizeMerchant("METRO 1234 TORONTO")).toBe("METRO TORONTO");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeMerchant("AMAZON\t\tCANADA")).toBe("AMAZON CANADA");
  });

  it("handles null and empty input", () => {
    expect(normalizeMerchant(null)).toBe("");
    expect(normalizeMerchant("")).toBe("");
    expect(normalizeMerchant("   ")).toBe("");
  });
});
