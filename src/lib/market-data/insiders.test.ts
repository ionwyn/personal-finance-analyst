import { describe, expect, it } from "vitest";

import { isOpenMarketInsiderTransaction, openMarketInsiderValue } from "./insiders";

const base = {
  change: 100,
  txPrice: 20,
  txDate: "2026-06-12",
  isDerivative: false,
};

describe("open-market insider transactions", () => {
  it("includes purchases and sales with the correct signed value", () => {
    expect(isOpenMarketInsiderTransaction({ ...base, txCode: "P" })).toBe(true);
    expect(openMarketInsiderValue({ ...base, txCode: "P" })).toBe(2000);

    expect(isOpenMarketInsiderTransaction({ ...base, change: -100, txCode: "S" })).toBe(true);
    expect(openMarketInsiderValue({ ...base, change: -100, txCode: "S" })).toBe(-2000);
  });

  it.each(["A", "F", "G", "H", "M", null])(
    "excludes non-open-market transaction code %s",
    (txCode) => {
      const transaction = { ...base, txCode };
      expect(isOpenMarketInsiderTransaction(transaction)).toBe(false);
      expect(openMarketInsiderValue(transaction)).toBeNull();
    }
  );

  it("excludes derivative transactions and rows without a trade date", () => {
    expect(isOpenMarketInsiderTransaction({ ...base, txCode: "P", isDerivative: true })).toBe(
      false
    );
    expect(isOpenMarketInsiderTransaction({ ...base, txCode: "P", txDate: null })).toBe(false);
  });
});
