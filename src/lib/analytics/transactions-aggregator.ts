import { Prisma } from "@prisma/client";

import {
  colorForCategory,
  monthKey,
  monthLabel,
  numberValue,
} from "@/lib/analytics/dashboard-helpers";
import { isLikelySubscription } from "@/lib/analytics/subscriptions";
import type { MonthlyCashflow, TransactionSummary } from "@/lib/analytics/types";
import { categorizeForSpending } from "@/lib/spending/classify";

export type TxWithAccount = Prisma.PlaidTransactionGetPayload<{ include: { account: true } }>;

type DateWindows = {
  monthKeys: string[];
  ninetyDaysAgo: Date;
  thirtyDaysAgo: Date;
  sevenDaysAgo: Date;
  currentMonthStart: Date;
  currentMonthEnd: Date;
  prevMonthStart: Date;
  prevMonthEnd: Date;
};

export type TransactionAggregate = {
  monthlyMap: Map<string, MonthlyCashflow>;
  categoryMap: Map<string, number>;
  categoryMap30: Map<string, number>;
  categoryMapMTD: Map<string, number>;
  categoryMap7: Map<string, number>;
  merchantMap: Map<string, number>;
  monthlySpend: number;
  monthlyIncome: number;
  prevMonthSpend: number;
  prevMonthIncome: number;
  largestExpense: TransactionSummary | null;
  monthExpenseCount: number;
  subscriptionMerchants: Map<string, number>;
};

export function initMonthlyMap(monthKeys: string[]): Map<string, MonthlyCashflow> {
  const map = new Map<string, MonthlyCashflow>();
  for (const key of monthKeys) {
    map.set(key, { month: monthLabel(key), income: 0, spending: 0, net: 0 });
  }
  return map;
}

export function aggregateTransactions(
  transactions: TxWithAccount[],
  windows: DateWindows
): TransactionAggregate {
  const agg: TransactionAggregate = {
    monthlyMap: initMonthlyMap(windows.monthKeys),
    categoryMap: new Map(),
    categoryMap30: new Map(),
    categoryMapMTD: new Map(),
    categoryMap7: new Map(),
    merchantMap: new Map(),
    monthlySpend: 0,
    monthlyIncome: 0,
    prevMonthSpend: 0,
    prevMonthIncome: 0,
    largestExpense: null,
    monthExpenseCount: 0,
    subscriptionMerchants: new Map(),
  };

  for (const t of transactions) {
    const amount = numberValue(t.amount);
    const bucket = categorizeForSpending(t);
    const isSpending = bucket === "spending";
    const isIncome = bucket === "income";
    const incomeValue = isIncome ? Math.abs(amount) : 0;
    const spendValue = isSpending ? amount : 0;

    const cashflow = agg.monthlyMap.get(monthKey(t.date));
    if (cashflow) {
      cashflow.income += incomeValue;
      cashflow.spending += spendValue;
      cashflow.net = cashflow.income - cashflow.spending;
    }

    if (t.date >= windows.currentMonthStart && t.date <= windows.currentMonthEnd) {
      if (isSpending) {
        agg.monthlySpend += amount;
        agg.monthExpenseCount += 1;
        if (!agg.largestExpense || amount > agg.largestExpense.amount) {
          agg.largestExpense = {
            id: t.id,
            name: t.merchantName ?? t.name,
            rawName: t.name,
            amount,
            date: t.date.toISOString(),
            category: t.categoryPrimary ?? "Uncategorized",
            categoryColor: "var(--cat-1)",
            account: t.account.name,
            pending: t.pending,
          };
        }
        if (isLikelySubscription(t.merchantName ?? t.name, t.categoryPrimary)) {
          const key = (t.merchantName ?? t.name).toLowerCase();
          agg.subscriptionMerchants.set(key, (agg.subscriptionMerchants.get(key) ?? 0) + amount);
        }
      }
      if (isIncome) agg.monthlyIncome += incomeValue;
    }

    if (t.date >= windows.prevMonthStart && t.date <= windows.prevMonthEnd) {
      if (isSpending) agg.prevMonthSpend += amount;
      if (isIncome) agg.prevMonthIncome += incomeValue;
    }

    if (isSpending) {
      const category = t.categoryPrimary ?? "Uncategorized";
      const merchant = t.merchantName ?? t.name;
      if (t.date >= windows.ninetyDaysAgo) {
        agg.categoryMap.set(category, (agg.categoryMap.get(category) ?? 0) + amount);
        agg.merchantMap.set(merchant, (agg.merchantMap.get(merchant) ?? 0) + amount);
      }
      if (t.date >= windows.thirtyDaysAgo) {
        agg.categoryMap30.set(category, (agg.categoryMap30.get(category) ?? 0) + amount);
      }
      if (t.date >= windows.currentMonthStart) {
        agg.categoryMapMTD.set(category, (agg.categoryMapMTD.get(category) ?? 0) + amount);
      }
      if (t.date >= windows.sevenDaysAgo) {
        agg.categoryMap7.set(category, (agg.categoryMap7.get(category) ?? 0) + amount);
      }
    }
  }

  return agg;
}

export function buildCategorySpend(
  map: Map<string, number>
): { category: string; amount: number; pct: number; color: string }[] {
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
    .map((c, i) => ({
      ...c,
      pct: total ? (c.amount / total) * 100 : 0,
      color: colorForCategory(c.category, i),
    }));
}

export function buildMerchantSpend(
  map: Map<string, number>
): { merchant: string; amount: number }[] {
  return [...map.entries()]
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}
