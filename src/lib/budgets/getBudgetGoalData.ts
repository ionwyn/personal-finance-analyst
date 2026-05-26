import { format, startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatCategoryName } from "@/lib/spending/category";
import { spendingWhere } from "@/lib/spending/classify";

const WARN_THRESHOLD = 0.8;

export type BudgetStatus = "under" | "warn" | "over";

export type BudgetProgress = {
  id: string;
  categoryPrimary: string;
  categoryLabel: string;
  cap: number;
  spent: number;
  remaining: number;
  pct: number;
  status: BudgetStatus;
};

export type GoalProgress = {
  id: string;
  name: string;
  target: number;
  saved: number;
  remaining: number;
  pct: number;
  reached: boolean;
  targetDate: string | null;
  destinationLabel: string | null;
  tracked: boolean;
};

export type BudgetGoalData = {
  monthLabel: string;
  budgets: BudgetProgress[];
  goals: GoalProgress[];
  totalCap: number;
  totalSpent: number;
};

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function matches(haystack: string, pattern: string) {
  if (!pattern) return false;
  return haystack.includes(pattern.toUpperCase());
}

export async function getBudgetGoalData(
  tenantId: string,
  now: Date = new Date()
): Promise<BudgetGoalData> {
  const monthStart = startOfMonth(now);

  const [budgets, goals, spendRows, savingsTxns] = await Promise.all([
    prisma.budget.findMany({
      where: { tenantId, active: true },
      orderBy: { categoryPrimary: "asc" },
    }),
    prisma.savingsGoal.findMany({
      where: { tenantId, active: true },
      include: {
        savingsDestination: { select: { matchPattern: true, label: true, accountName: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.plaidTransaction.groupBy({
      by: ["categoryPrimary"],
      where: spendingWhere(tenantId, monthStart, now),
      _sum: { amount: true },
    }),
    // All savings-classified transactions; matched to a goal's destination by pattern.
    prisma.plaidTransaction.findMany({
      where: { tenantId, txnType: "savings", removed: false, supersededById: null },
      select: { name: true, merchantName: true, amount: true },
    }),
  ]);

  const spendByCategory = new Map<string, number>();
  for (const row of spendRows) {
    if (!row.categoryPrimary) continue;
    spendByCategory.set(row.categoryPrimary, Math.max(0, num(row._sum.amount)));
  }

  const budgetProgress: BudgetProgress[] = budgets.map((b) => {
    const cap = num(b.amount);
    const spent = spendByCategory.get(b.categoryPrimary) ?? 0;
    const pct = cap > 0 ? (spent / cap) * 100 : 0;
    const status: BudgetStatus =
      spent > cap ? "over" : pct >= WARN_THRESHOLD * 100 ? "warn" : "under";
    return {
      id: b.id,
      categoryPrimary: b.categoryPrimary,
      categoryLabel: formatCategoryName(b.categoryPrimary),
      cap,
      spent,
      remaining: cap - spent,
      pct,
      status,
    };
  });

  const goalProgress: GoalProgress[] = goals.map((g) => {
    const target = num(g.targetAmount);
    const pattern = g.savingsDestination?.matchPattern ?? null;
    let saved = 0;
    if (pattern) {
      for (const tx of savingsTxns) {
        const merchant = `${tx.name ?? ""} ${tx.merchantName ?? ""}`.toUpperCase();
        if (matches(merchant, pattern)) saved += Math.max(0, num(tx.amount));
      }
    }
    const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    return {
      id: g.id,
      name: g.name,
      target,
      saved,
      remaining: Math.max(0, target - saved),
      pct,
      reached: saved >= target && target > 0,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      destinationLabel: g.savingsDestination
        ? (g.savingsDestination.label ?? g.savingsDestination.accountName)
        : null,
      tracked: Boolean(pattern),
    };
  });

  return {
    monthLabel: format(now, "MMMM yyyy"),
    budgets: budgetProgress,
    goals: goalProgress,
    totalCap: budgetProgress.reduce((s, b) => s + b.cap, 0),
    totalSpent: budgetProgress.reduce((s, b) => s + b.spent, 0),
  };
}
