import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { classifyTransaction, type ClassifyContext } from "@/lib/cycles/classify";

function ctx(partial: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    savingsDestinations: [],
    settlementPatterns: [],
    categoryRules: [],
    employerMerchantPattern: null,
    expectedPaycheckDates: [],
    ...partial
  };
}

const DATE = new Date("2026-05-08T00:00:00.000Z");

describe("classifyTransaction", () => {
  it("flags savings destination matches on debits", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(250), merchantName: "Wealthsimple", date: DATE },
      ctx({ savingsDestinations: [{ id: "s1", matchPattern: "WEALTHSIMPLE", active: true }] })
    );
    expect(result.txnType).toBe("savings");
  });

  it("does not flag savings on credits even if merchant matches", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-250), merchantName: "Wealthsimple", date: DATE },
      ctx({ savingsDestinations: [{ id: "s1", matchPattern: "WEALTHSIMPLE", active: true }] })
    );
    expect(result.txnType).toBe("expense");
  });

  it("savings precedence over settlement", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(250), merchantName: "Wealthsimple Visa Payment", date: DATE },
      ctx({
        savingsDestinations: [{ id: "s1", matchPattern: "WEALTHSIMPLE", active: true }],
        settlementPatterns: [{ id: "p1", matchPattern: "VISA PAYMENT", active: true }]
      })
    );
    expect(result.txnType).toBe("savings");
  });

  it("flags settlement when no savings match", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(1500), merchantName: "TD Visa Payment", date: DATE },
      ctx({ settlementPatterns: [{ id: "p1", matchPattern: "TD VISA PAYMENT", active: true }] })
    );
    expect(result.txnType).toBe("settlement");
  });

  it("flags income on credits when employer matches and date in window", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-2840), merchantName: "Acme Payroll", date: DATE },
      ctx({ employerMerchantPattern: "ACME", expectedPaycheckDates: [DATE] })
    );
    expect(result.txnType).toBe("income");
  });

  it("rejects income when outside ±1 day window", () => {
    const offDate = new Date("2026-05-12T00:00:00.000Z");
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-2840), merchantName: "Acme Payroll", date: offDate },
      ctx({ employerMerchantPattern: "ACME", expectedPaycheckDates: [DATE] })
    );
    expect(result.txnType).toBe("expense");
  });

  it("applies highest-priority category rule", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(15), merchantName: "Loblaws", date: DATE },
      ctx({
        categoryRules: [
          { merchantPattern: "LOBLAW", categoryId: "cat-groceries", priority: 5 },
          { merchantPattern: "LO", categoryId: "cat-other", priority: 1 }
        ]
      })
    );
    expect(result.txnType).toBe("expense");
    expect(result.categoryId).toBe("cat-groceries");
  });

  it("preserves manual categorization", () => {
    const result = classifyTransaction(
      {
        amount: new Prisma.Decimal(15),
        merchantName: "Loblaws",
        date: DATE,
        isManuallyCategorized: true,
        existingTxnType: "expense",
        existingCategoryId: "cat-manual"
      },
      ctx({
        categoryRules: [{ merchantPattern: "LOBLAW", categoryId: "cat-rule", priority: 5 }]
      })
    );
    expect(result.categoryId).toBe("cat-manual");
  });

  it("falls back to expense + null category", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(7), merchantName: "Unknown Merchant", date: DATE },
      ctx()
    );
    expect(result.txnType).toBe("expense");
    expect(result.categoryId).toBeNull();
  });
});
