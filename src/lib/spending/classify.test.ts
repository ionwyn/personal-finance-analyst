import { describe, expect, it } from "vitest";

import { categorizeForSpending, type ClassifiableTxn } from "@/lib/spending/classify";

function expense(amount: number): ClassifiableTxn {
  return {
    amount,
    txnType: "expense",
    categoryPrimary: "FOOD_AND_DRINK",
    categoryDetailed: "FOOD_AND_DRINK_RESTAURANT",
    removed: false,
    supersededById: null,
  };
}

describe("categorizeForSpending", () => {
  it("keeps merchant correction credits in spending so they offset the original debit", () => {
    const transactions = [expense(41), expense(41.21), expense(-41)];

    const netSpending = transactions
      .filter((transaction) => categorizeForSpending(transaction) === "spending")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    expect(transactions.map(categorizeForSpending)).toEqual(["spending", "spending", "spending"]);
    expect(netSpending).toBeCloseTo(41.21, 2);
  });
});
