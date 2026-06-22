import { format, startOfMonth, subMonths } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatCategoryName } from "@/lib/spending/category";
import { spendingWhere } from "@/lib/spending/classify";
import { hashColor } from "@/lib/spending/color";

export type BudgetStatus = "under" | "warn" | "over";

export type BudgetProgress = {
  id: string;
  categoryPrimary: string;
  categoryLabel: string;
  color: string;
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
  color: string;
  startDate: string | null;
  targetDate: string | null;
  savingsDestinationId: string | null;
  destinationLabel: string | null;
  manualAmount: number;
  tracked: boolean;
};

export type CategoryOption = { raw: string; label: string };

export type BudgetGoalData = {
  monthLabel: string;
  warnPct: number;
  alarmPct: number;
  rollForward: boolean;
  budgets: BudgetProgress[];
  goals: GoalProgress[];
  totalCap: number;
  totalSpent: number;
  /** Categories the tenant spends in that aren't budgeted yet (for the add picker). */
  availableCategories: CategoryOption[];
  /** Active savings destinations (for linking a goal). */
  destinations: { id: string; label: string }[];
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

  const [settings, budgets, goals, spendRows, recentSpendRows, savingsTxns, destinations] =
    await Promise.all([
      prisma.userSettings.findUnique({
        where: { tenantId },
        select: { budgetWarnPct: true, budgetAlarmPct: true, budgetRollForward: true },
      }),
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
      // Categories the tenant has spent in over the last 6 months — for the add picker.
      prisma.plaidTransaction.groupBy({
        by: ["categoryPrimary"],
        where: spendingWhere(tenantId, subMonths(now, 6), now),
        _sum: { amount: true },
      }),
      prisma.plaidTransaction.findMany({
        where: { tenantId, txnType: "savings", removed: false, supersededById: null },
        select: { name: true, merchantName: true, amount: true, date: true },
      }),
      prisma.savingsDestination.findMany({
        where: { tenantId, active: true },
        orderBy: [{ accountName: "asc" }],
        select: { id: true, label: true, accountName: true },
      }),
    ]);

  const warnPct = settings?.budgetWarnPct ?? 85;
  const alarmPct = settings?.budgetAlarmPct ?? 100;
  const rollForward = settings?.budgetRollForward ?? false;

  const spendByCategory = new Map<string, number>();
  for (const row of spendRows) {
    if (!row.categoryPrimary) continue;
    spendByCategory.set(row.categoryPrimary, Math.max(0, num(row._sum.amount)));
  }

  const budgetProgress: BudgetProgress[] = budgets.map((b) => {
    const cap = num(b.amount);
    const spent = spendByCategory.get(b.categoryPrimary) ?? 0;
    const pct = cap > 0 ? (spent / cap) * 100 : 0;
    const status: BudgetStatus = pct >= alarmPct ? "over" : pct >= warnPct ? "warn" : "under";
    return {
      id: b.id,
      categoryPrimary: b.categoryPrimary,
      categoryLabel: formatCategoryName(b.categoryPrimary),
      color: hashColor(formatCategoryName(b.categoryPrimary)),
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
    // Only count savings on or after the goal's start date (inclusive). Goals
    // with no start date count all-time savings to the destination.
    const since = g.startDate ? g.startDate.getTime() : null;
    let saved = 0;
    if (pattern) {
      for (const tx of savingsTxns) {
        if (since !== null && tx.date.getTime() < since) continue;
        const merchant = `${tx.name ?? ""} ${tx.merchantName ?? ""}`.toUpperCase();
        if (matches(merchant, pattern)) saved += Math.max(0, num(tx.amount));
      }
    } else {
      saved = Math.max(0, num(g.manualAmount));
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
      color: hashColor(g.name),
      startDate: g.startDate ? g.startDate.toISOString() : null,
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      savingsDestinationId: g.savingsDestinationId,
      destinationLabel: g.savingsDestination
        ? (g.savingsDestination.label ?? g.savingsDestination.accountName)
        : null,
      manualAmount: Math.max(0, num(g.manualAmount)),
      tracked: Boolean(pattern),
    };
  });

  const budgeted = new Set(budgets.map((b) => b.categoryPrimary));
  const availableCategories: CategoryOption[] = recentSpendRows
    .map((r) => r.categoryPrimary)
    .filter((c): c is string => Boolean(c) && !budgeted.has(c as string))
    .sort()
    .map((raw) => ({ raw, label: formatCategoryName(raw) }));

  return {
    monthLabel: format(now, "MMMM yyyy"),
    warnPct,
    alarmPct,
    rollForward,
    budgets: budgetProgress,
    goals: goalProgress,
    totalCap: budgetProgress.reduce((s, b) => s + b.cap, 0),
    totalSpent: budgetProgress.reduce((s, b) => s + b.spent, 0),
    availableCategories,
    destinations: destinations.map((d) => ({ id: d.id, label: d.label ?? d.accountName })),
  };
}
