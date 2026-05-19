import { describe, expect, it } from "vitest";

import { computeSafeToSweep } from "@/lib/cycles/safeToSweep";

describe("computeSafeToSweep", () => {
  it("returns balance minus reserved obligations", () => {
    const result = computeSafeToSweep({
      chequingBalance: 3000,
      pendingExpenses: 200,
      unsettledAccruals: 800,
      sweepBuffer: 100,
    });
    expect(result.amount.toNumber()).toBe(1900);
    expect(result.overCommitted).toBe(false);
  });

  it("clamps to zero when overcommitted and flags it", () => {
    const result = computeSafeToSweep({
      chequingBalance: 500,
      pendingExpenses: 700,
    });
    expect(result.amount.toNumber()).toBe(0);
    expect(result.overCommitted).toBe(true);
    expect(result.rawAmount.toNumber()).toBe(-200);
  });

  it("subtracts credit card balance from sweepable cash", () => {
    const result = computeSafeToSweep({
      chequingBalance: 3000,
      creditCardBalance: 1500,
      sweepBuffer: 100,
    });
    expect(result.amount.toNumber()).toBe(1400);
  });

  it("excludes CC balance when caller leaves it unset", () => {
    const result = computeSafeToSweep({
      chequingBalance: 3000,
      sweepBuffer: 100,
    });
    expect(result.amount.toNumber()).toBe(2900);
  });

  it("adds positive carryover from previous cycle", () => {
    const result = computeSafeToSweep({
      chequingBalance: 1000,
      sweepBuffer: 100,
      carryover: 250,
    });
    expect(result.amount.toNumber()).toBe(1150);
  });

  it("subtracts negative carryover from previous cycle", () => {
    const result = computeSafeToSweep({
      chequingBalance: 1000,
      sweepBuffer: 100,
      carryover: -250,
    });
    expect(result.amount.toNumber()).toBe(650);
  });
});
