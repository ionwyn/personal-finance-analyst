import { Prisma } from "@prisma/client";

import type { TxnType } from "@/lib/cycles/types";

const INCOME_DATE_TOLERANCE_DAYS = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ClassifyInput = {
  amount: Prisma.Decimal | number;
  merchantName?: string | null;
  name?: string | null;
  date: Date;
  isManuallyCategorized?: boolean;
  existingTxnType?: string | null;
  existingCategoryId?: string | null;
};

export type ClassifyContext = {
  savingsDestinations: Array<{ id: string; matchPattern: string; active: boolean }>;
  settlementPatterns: Array<{ id: string; matchPattern: string; active: boolean }>;
  categoryRules: Array<{ merchantPattern: string; categoryId: string; priority: number }>;
  employerMerchantPattern?: string | null;
  expectedPaycheckDates?: Date[];
};

export type ClassifyResult = {
  txnType: TxnType;
  categoryId: string | null;
  reason: string;
};

function toAmountNumber(value: Prisma.Decimal | number) {
  if (typeof value === "number") return value;
  return Number(value.toString());
}

function searchableMerchant(input: ClassifyInput) {
  return `${input.merchantName ?? ""} ${input.name ?? ""}`.toUpperCase().trim();
}

function matchesPattern(haystack: string, pattern: string) {
  if (!pattern) return false;
  return haystack.includes(pattern.toUpperCase());
}

function withinPaycheckWindow(date: Date, expectedDates: Date[]) {
  if (!expectedDates.length) return true;
  return expectedDates.some(
    (expected) => Math.abs(date.getTime() - expected.getTime()) <= INCOME_DATE_TOLERANCE_DAYS * DAY_MS
  );
}

export function classifyTransaction(input: ClassifyInput, ctx: ClassifyContext): ClassifyResult {
  if (input.isManuallyCategorized) {
    return {
      txnType: (input.existingTxnType as TxnType) || "expense",
      categoryId: input.existingCategoryId ?? null,
      reason: "manual-lock"
    };
  }

  const amount = toAmountNumber(input.amount);
  const merchant = searchableMerchant(input);
  const isDebit = amount > 0;
  const isCredit = amount < 0;

  if (isDebit) {
    for (const dest of ctx.savingsDestinations) {
      if (!dest.active) continue;
      if (matchesPattern(merchant, dest.matchPattern)) {
        return { txnType: "savings", categoryId: null, reason: `savings:${dest.matchPattern}` };
      }
    }

    for (const pattern of ctx.settlementPatterns) {
      if (!pattern.active) continue;
      if (matchesPattern(merchant, pattern.matchPattern)) {
        return { txnType: "settlement", categoryId: null, reason: `settlement:${pattern.matchPattern}` };
      }
    }
  }

  if (isCredit && ctx.employerMerchantPattern && matchesPattern(merchant, ctx.employerMerchantPattern)) {
    if (withinPaycheckWindow(input.date, ctx.expectedPaycheckDates ?? [])) {
      return { txnType: "income", categoryId: null, reason: "income:employer" };
    }
  }

  const sortedRules = [...ctx.categoryRules].sort((a, b) => b.priority - a.priority);
  for (const rule of sortedRules) {
    if (matchesPattern(merchant, rule.merchantPattern)) {
      return { txnType: "expense", categoryId: rule.categoryId, reason: `rule:${rule.merchantPattern}` };
    }
  }

  return { txnType: "expense", categoryId: null, reason: "fallback" };
}
