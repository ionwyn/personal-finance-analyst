import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { classifyTransaction, type ClassifyContext } from "@/lib/cycles/classify";

function ctx(partial: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    savingsDestinations: [],
    settlementPatterns: [],
    incomeSources: [],
    employerMerchantPattern: null,
    expectedPaycheckDates: [],
    ...partial,
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
        settlementPatterns: [{ id: "p1", matchPattern: "VISA PAYMENT", active: true }],
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

  it("flags income for any matching income source (multiple sources)", () => {
    const context = ctx({
      incomeSources: [
        { id: "i1", matchPattern: "ACME PAYROLL", active: true },
        { id: "i2", matchPattern: "SIDE GIG", active: true },
      ],
      expectedPaycheckDates: [DATE],
    });
    expect(
      classifyTransaction(
        { amount: new Prisma.Decimal(-2840), merchantName: "Acme Payroll Deposit", date: DATE },
        context
      ).txnType
    ).toBe("income");
    expect(
      classifyTransaction(
        { amount: new Prisma.Decimal(-600), merchantName: "Side Gig LLC", date: DATE },
        context
      ).txnType
    ).toBe("income");
  });

  it("ignores inactive income sources", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-600), merchantName: "Side Gig LLC", date: DATE },
      ctx({
        incomeSources: [{ id: "i2", matchPattern: "SIDE GIG", active: false }],
        expectedPaycheckDates: [DATE],
      })
    );
    expect(result.txnType).toBe("expense");
  });

  it("respects the paycheck window for income sources", () => {
    const offDate = new Date("2026-05-12T00:00:00.000Z");
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-2840), merchantName: "Acme Payroll", date: offDate },
      ctx({
        incomeSources: [{ id: "i1", matchPattern: "ACME PAYROLL", active: true }],
        expectedPaycheckDates: [DATE],
      })
    );
    expect(result.txnType).toBe("expense");
  });

  it("rejects income when outside ±1 day window", () => {
    const offDate = new Date("2026-05-12T00:00:00.000Z");
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(-2840), merchantName: "Acme Payroll", date: offDate },
      ctx({ employerMerchantPattern: "ACME", expectedPaycheckDates: [DATE] })
    );
    expect(result.txnType).toBe("expense");
  });

  it("flags Plaid salary credits as income even when the employer pattern changed", () => {
    const result = classifyTransaction(
      {
        amount: new Prisma.Decimal(-2840),
        merchantName: "Legacy Payroll",
        categoryPrimary: "INCOME",
        categoryDetailed: "INCOME_SALARY",
        date: DATE,
      },
      ctx({ employerMerchantPattern: "ACME", expectedPaycheckDates: [DATE] })
    );
    expect(result.txnType).toBe("income");
  });

  it("falls back to expense type", () => {
    const result = classifyTransaction(
      { amount: new Prisma.Decimal(7), merchantName: "Unknown Merchant", date: DATE },
      ctx()
    );
    expect(result.txnType).toBe("expense");
  });
});
