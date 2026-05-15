import type { Prisma } from "@prisma/client";

export type SpendingBucket =
  | "spending"
  | "income"
  | "transfer"
  | "savings"
  | "settlement"
  | "ignore";

export type ClassifiableTxn = {
  amount: Prisma.Decimal | number;
  txnType: string;
  categoryPrimary: string | null;
  categoryDetailed: string | null;
  removed: boolean;
  supersededById: string | null;
};

const TRANSFER_PRIMARIES = new Set(["TRANSFER_IN", "TRANSFER_OUT"]);

const SETTLEMENT_DETAILED = new Set([
  "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "TRANSFER_OUT_ACCOUNT_TRANSFER",
  "TRANSFER_IN_ACCOUNT_TRANSFER"
]);

const SAVINGS_DETAILED = new Set([
  "TRANSFER_OUT_SAVINGS",
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"
]);

export function categorizeForSpending(t: ClassifiableTxn): SpendingBucket {
  if (t.removed || t.supersededById) return "ignore";

  if (t.txnType === "income") return "income";
  if (t.txnType === "savings") return "savings";
  if (t.txnType === "settlement") return "settlement";
  if (t.txnType === "transfer") return "transfer";

  const p = t.categoryPrimary ?? "";
  const d = t.categoryDetailed ?? "";
  if (TRANSFER_PRIMARIES.has(p)) return "transfer";
  if (SETTLEMENT_DETAILED.has(d)) return "settlement";
  if (SAVINGS_DETAILED.has(d)) return "savings";
  if (p === "LOAN_PAYMENTS") return "settlement";
  if (p === "INCOME") return "income";

  return "spending";
}

export const isRealSpending = (t: ClassifiableTxn) =>
  categorizeForSpending(t) === "spending";

export const isRealIncome = (t: ClassifiableTxn) =>
  categorizeForSpending(t) === "income";

/**
 * Composable Prisma where-partial that narrows to "real spending" — txnType
 * `expense` excluding internal transfers, CC/loan payments, and savings moves.
 * Spread into any query: `{ ...SPENDING_FILTER, tenantId, cycleId }`.
 */
export const SPENDING_FILTER: Prisma.PlaidTransactionWhereInput = {
  removed: false,
  supersededById: null,
  txnType: "expense",
  NOT: {
    OR: [
      { categoryPrimary: { in: [...TRANSFER_PRIMARIES] } },
      { categoryPrimary: "INCOME" },
      { categoryPrimary: "LOAN_PAYMENTS" },
      {
        categoryDetailed: {
          in: [...SETTLEMENT_DETAILED, ...SAVINGS_DETAILED]
        }
      }
    ]
  }
};

/**
 * Composable Prisma where-partial that narrows to "real income" — credits
 * (negative amounts) excluding internal account transfers in.
 */
export const INCOME_FILTER: Prisma.PlaidTransactionWhereInput = {
  removed: false,
  supersededById: null,
  amount: { lt: 0 },
  NOT: {
    OR: [
      { categoryPrimary: "TRANSFER_IN" },
      { categoryDetailed: "TRANSFER_IN_ACCOUNT_TRANSFER" }
    ]
  }
};

export function spendingWhere(
  tenantId: string,
  gte: Date,
  lt: Date
): Prisma.PlaidTransactionWhereInput {
  return { ...SPENDING_FILTER, tenantId, date: { gte, lt } };
}

export function incomeWhere(
  tenantId: string,
  gte: Date,
  lt: Date
): Prisma.PlaidTransactionWhereInput {
  return { ...INCOME_FILTER, tenantId, date: { gte, lt } };
}
