import { describe, expect, it } from "vitest";

import { monthlyEquivalent } from "./getCalculatorData";

describe("monthlyEquivalent", () => {
  it("normalizes recurring frequencies to a monthly amount", () => {
    expect(monthlyEquivalent(120, "monthly")).toBe(120);
    expect(monthlyEquivalent(1200, "annual")).toBe(100);
    expect(monthlyEquivalent(100, "biweekly")).toBeCloseTo(216.67, 2);
    expect(monthlyEquivalent(100, "weekly")).toBeCloseTo(433.33, 2);
  });
});
