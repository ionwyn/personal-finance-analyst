import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashColor } from "@/lib/spending/color";
import { SPENDING_FILTER } from "@/lib/spending/classify";

export type SpendingBreakdownRow = {
  category: string;
  color: string;
  amount: number;
  pct: number;
  delta: number | null;
  prevAmount: number;
  prevPct: number;
};

export type SpendingBreakdownData = {
  rows: SpendingBreakdownRow[];
  total: number;
  previousTotal: number;
  discretionarySpent: number;
  discretionaryBudget: number;
  discretionaryRemaining: number;
};

const UNCATEGORIZED = "Uncategorized";

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function formatCategoryName(raw: string | null): string {
  if (!raw) return UNCATEGORIZED;
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function spendByCategory(tenantId: string, cycleId: string) {
  const rows = await prisma.plaidTransaction.groupBy({
    by: ["categoryPrimary"],
    where: { ...SPENDING_FILTER, tenantId, cycleId },
    _sum: { amount: true },
  });
  const map = new Map<string | null, number>();
  for (const r of rows) {
    map.set(r.categoryPrimary, num(r._sum.amount));
  }
  return map;
}

export async function getSpendingBreakdown(
  tenantId: string,
  cycleId: string,
  previousCycleId: string | null,
  discretionaryBudget: number
): Promise<SpendingBreakdownData> {
  const [currentMap, previousMap] = await Promise.all([
    spendByCategory(tenantId, cycleId),
    previousCycleId
      ? spendByCategory(tenantId, previousCycleId)
      : Promise.resolve(new Map<string | null, number>()),
  ]);

  const total = [...currentMap.values()].reduce((s, v) => s + v, 0);
  const previousTotal = [...previousMap.values()].reduce((s, v) => s + v, 0);

  const rows: SpendingBreakdownRow[] = [];

  for (const [categoryPrimary, amount] of currentMap.entries()) {
    if (amount <= 0) continue;
    const name = formatCategoryName(categoryPrimary);
    const previousAmount = previousMap.get(categoryPrimary) ?? 0;
    rows.push({
      category: name,
      color: hashColor(name),
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
      delta: previousAmount > 0 ? amount - previousAmount : null,
      prevAmount: previousAmount,
      prevPct: previousTotal > 0 ? (previousAmount / previousTotal) * 100 : 0,
    });
  }

  rows.sort((a, b) => b.amount - a.amount);

  const discretionarySpent = total;
  const discretionaryRemaining = discretionaryBudget - discretionarySpent;

  return {
    rows,
    total,
    previousTotal,
    discretionarySpent,
    discretionaryBudget,
    discretionaryRemaining,
  };
}

export async function findPreviousCycleId(
  tenantId: string,
  currentStartDate: Date
): Promise<string | null> {
  const prev = await prisma.payCycle.findFirst({
    where: { tenantId, endDate: { lt: currentStartDate } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  return prev?.id ?? null;
}
